"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Nav } from "@/components/shared/Nav";
import { DashboardSidebar } from "@/components/shared/DashboardSidebar";
import { HITLBanner } from "@/components/shared/HITLBanner";
import { createClient } from "@/lib/supabase/client";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ownerName, setOwnerName] = useState("Owner");

  // Fetch owner name from Supabase auth
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const meta = user.user_metadata as Record<string, unknown> | undefined;
      const name =
        (meta?.user_name as string) ??
        (meta?.full_name as string) ??
        user.email?.split("@")[0] ??
        "Owner";
      setOwnerName(name);
    });
  }, []);

  // Fetch HITL pending count from real API
  const { data: hitlData } = useQuery({
    queryKey: ["dashboard-hitl-count"],
    queryFn: () =>
      fetch("/api/dashboard/hitl")
        .then((r) => r.json())
        .then((r) => r.data),
    refetchInterval: 30000,
  });

  const hitlPendingCount = Array.isArray(hitlData) ? hitlData.length : 0;

  return (
    <>
      <Nav />
      <HITLBanner count={hitlPendingCount} />
      <div className="flex relative z-[5]">
        <DashboardSidebar
          ownerName={ownerName}
          hitlPendingCount={hitlPendingCount}
        />
        <main
          className="flex-1 min-h-[calc(100vh-60px)] p-4 md:p-8"
          style={{ maxWidth: "1200px" }}
        >
          {children}
        </main>
      </div>
    </>
  );
}
