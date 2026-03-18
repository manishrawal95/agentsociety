import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { classifyInjectionRisk } from "@/lib/security/injection-classifier";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
  const mine = searchParams.get("mine") === "true";

  // If ?mine=true, scope to the authenticated user's posts
  if (mine) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { data: null, error: { code: "unauthorized", message: "Sign in required" } },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("human_posts")
      .select("*, owner:owners(id, username, display_name)")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ data: null, error: { code: "db_error", message: error.message } }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [], error: null });
  }

  const { data, error } = await supabaseAdmin
    .from("human_posts")
    .select("*, owner:owners(id, username, display_name)")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ data: null, error: { code: "db_error", message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], error: null });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { data: null, error: { code: "unauthorized", message: "Sign in required" } },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { data: null, error: { code: "bad_request", message: "Invalid JSON" } },
      { status: 400 }
    );
  }

  const title = String(body.title ?? "").trim();
  const postBody = String(body.body ?? "").trim();
  const postType = String(body.post_type ?? "question");
  const communityId = String(body.community_id ?? "");
  const targetAgentHandle = body.target_agent_handle ? String(body.target_agent_handle) : null;

  // Validate
  if (title.length < 10 || title.length > 300) {
    return NextResponse.json(
      { data: null, error: { code: "validation_error", message: "Title must be 10-300 characters" } },
      { status: 422 }
    );
  }
  if (postBody.length < 20) {
    return NextResponse.json(
      { data: null, error: { code: "validation_error", message: "Body must be at least 20 characters" } },
      { status: 422 }
    );
  }
  if (!["question", "challenge", "observation", "submission"].includes(postType)) {
    return NextResponse.json(
      { data: null, error: { code: "validation_error", message: "Invalid post type" } },
      { status: 422 }
    );
  }

  // Injection check
  const injection = classifyInjectionRisk(postBody);
  if (injection.risk_level === "high") {
    return NextResponse.json(
      { data: null, error: { code: "injection_detected", message: "Content contains disallowed patterns", patterns: injection.patterns_found } },
      { status: 422 }
    );
  }

  // Rate limit: max 10 posts per day
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { data: todayCount } = await supabaseAdmin
    .from("human_posts")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .gte("created_at", startOfDay.toISOString());

  if ((todayCount as unknown as number) >= 10) {
    return NextResponse.json(
      { data: null, error: { code: "rate_limited", message: "Max 10 posts per day" } },
      { status: 429 }
    );
  }

  // Use sanitized content if medium risk
  const finalBody = injection.risk_level === "medium" ? injection.sanitized_content : postBody;

  // Insert
  const { data: post, error: insertError } = await supabaseAdmin
    .from("human_posts")
    .insert({
      owner_id: user.id,
      community_id: communityId,
      title,
      body: finalBody,
      post_type: postType,
      target_agent_handle: targetAgentHandle,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[api/human/posts] insert failed:", insertError.message);
    return NextResponse.json(
      { data: null, error: { code: "db_error", message: "Failed to create post" } },
      { status: 500 }
    );
  }

  // If challenge with target agent, create HITL queue item
  if (postType === "challenge" && targetAgentHandle) {
    const { data: targetAgent } = await supabaseAdmin
      .from("agents")
      .select("id")
      .eq("handle", targetAgentHandle)
      .single();

    if (targetAgent) {
      await supabaseAdmin.from("hitl_queue").insert({
        agent_id: targetAgent.id,
        action_type: "challenge_received",
        action_payload: {
          human_post_id: post.id,
          challenger_display_name: user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "Human",
          challenge_body_preview: finalBody.slice(0, 200),
        },
        reversibility_score: 1.0,
        status: "pending",
      });
    }
  }

  // Update owner post count
  const { data: ownerData } = await supabaseAdmin.from("owners").select("post_count").eq("id", user.id).single();
  if (ownerData) {
    await supabaseAdmin.from("owners").update({ post_count: ((ownerData.post_count as number) ?? 0) + 1 }).eq("id", user.id);
  }

  return NextResponse.json({ data: { id: post.id }, error: null }, { status: 201 });
}
