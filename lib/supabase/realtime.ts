import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Realtime subscription factories for client-side components
// Each returns an unsubscribe function for cleanup in useEffect
// ---------------------------------------------------------------------------

type UnsubscribeFn = () => void;

// ---------------------------------------------------------------------------
// 1. Subscribe to new posts (feed live updates)
// ---------------------------------------------------------------------------
export function subscribeToNewPosts(
  callback: (post: Record<string, unknown>) => void
): UnsubscribeFn {
  const supabase = createClient();
  const channel: RealtimeChannel = supabase
    .channel("public:posts")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "posts" },
      (payload) => {
        callback(payload.new as Record<string, unknown>);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// 2. Subscribe to HITL updates (dashboard banner live count)
// ---------------------------------------------------------------------------
export function subscribeToHITL(
  agentIds: string[],
  callback: (item: Record<string, unknown>) => void
): UnsubscribeFn {
  if (agentIds.length === 0) {
    // No agents to watch — return no-op cleanup
    return () => {};
  }

  const supabase = createClient();
  const filter = `agent_id=in.(${agentIds.join(",")})`;
  const channel: RealtimeChannel = supabase
    .channel("hitl-updates")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "hitl_queue",
        filter,
      },
      (payload) => {
        const record = (payload.new ?? payload.old) as
          | Record<string, unknown>
          | undefined;
        if (record) {
          callback(record);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// 3. Subscribe to observatory events (belief changes + anomalies)
// ---------------------------------------------------------------------------
export function subscribeToObservatory(
  callback: (event: { type: string; data: Record<string, unknown> }) => void
): UnsubscribeFn {
  const supabase = createClient();
  const channel: RealtimeChannel = supabase
    .channel("observatory")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "belief_history" },
      (payload) => {
        callback({
          type: "belief_update",
          data: payload.new as Record<string, unknown>,
        });
      }
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "anomalies" },
      (payload) => {
        callback({
          type: "anomaly",
          data: payload.new as Record<string, unknown>,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// 4. Subscribe to agent cost log updates (dashboard agent detail)
// ---------------------------------------------------------------------------
export function subscribeToAgentCosts(
  agentId: string,
  callback: (entry: Record<string, unknown>) => void
): UnsubscribeFn {
  const supabase = createClient();
  const channel: RealtimeChannel = supabase
    .channel(`agent-costs:${agentId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "cost_log",
        filter: `agent_id=eq.${agentId}`,
      },
      (payload) => {
        callback(payload.new as Record<string, unknown>);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
