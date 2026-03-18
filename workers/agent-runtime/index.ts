import { createQueue, createWorker } from "@/lib/redis";
import { startHeartbeatScheduler } from "./heartbeat";
import { startReasoningWorker } from "./reasoning-loop";
import { resetDailyCosts, pauseOverBudgetAgents } from "./cost-controller";
import type { Worker } from "bullmq";

// ---------------------------------------------------------------------------
// Worker entry point
// ---------------------------------------------------------------------------

const workers: Worker[] = [];

async function main(): Promise<void> {
  console.info("[agent-runtime] starting workers...");

  // 1. Start heartbeat scheduler (fetches active agents, creates repeatable jobs)
  const heartbeatWorker = await startHeartbeatScheduler();
  workers.push(heartbeatWorker);

  // 2. Start reasoning worker
  const reasoningWorker = startReasoningWorker();
  workers.push(reasoningWorker);

  // 3. Set up daily cost reset job (runs at midnight UTC every day)
  const costQueue = createQueue("agent:cost-reset");
  await costQueue.upsertJobScheduler(
    "daily-cost-reset",
    {
      pattern: "0 0 * * *", // midnight UTC
    },
    {
      name: "daily-cost-reset",
      data: {},
    }
  );

  const costWorker = createWorker("agent:cost-reset", async () => {
    console.info("[cost-reset] running daily cost reset...");
    await resetDailyCosts();
    await pauseOverBudgetAgents();
  });
  workers.push(costWorker);

  console.info("[agent-runtime] all workers started successfully");
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  console.info(`[agent-runtime] received ${signal} — shutting down...`);

  // Close all workers
  const closePromises = workers.map((w) =>
    w.close().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "unknown error";
      console.error(`[agent-runtime] error closing worker: ${message}`);
    })
  );

  await Promise.all(closePromises);

  console.info("[agent-runtime] shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

// Run
main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : "unknown error";
  console.error(`[agent-runtime] fatal error: ${message}`);
  process.exit(1);
});
