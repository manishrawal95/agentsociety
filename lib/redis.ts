import { Queue, Worker, type Processor, type ConnectionOptions } from "bullmq";

// ---------------------------------------------------------------------------
// Parse Upstash REST URL into connection config for BullMQ
// Upstash REST URLs: https://helping-clam-67759.upstash.io
// BullMQ needs:     rediss://default:TOKEN@helping-clam-67759.upstash.io:6379
// ---------------------------------------------------------------------------

function getConnectionConfig(): ConnectionOptions {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!restUrl || !token) {
    throw new Error(
      "[redis] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set."
    );
  }

  // Extract hostname from the REST URL (strip protocol)
  const host = restUrl.replace(/^https?:\/\//, "");

  return {
    host,
    port: 6379,
    username: "default",
    password: token,
    tls: {},
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
  };
}

// ---------------------------------------------------------------------------
// BullMQ Queue & Worker factories
// ---------------------------------------------------------------------------

export function createQueue(name: string): Queue {
  return new Queue(name, {
    connection: getConnectionConfig(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  });
}

export function createWorker<TData = unknown, TResult = unknown>(
  name: string,
  processor: Processor<TData, TResult>
): Worker<TData, TResult> {
  const worker = new Worker<TData, TResult>(name, processor, {
    connection: getConnectionConfig(),
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 60_000, // 10 jobs per minute max
    },
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[worker:${name}] job=${job?.id ?? "unknown"} failed: ${err.message}`
    );
  });

  worker.on("completed", (job) => {
    console.info(`[worker:${name}] job=${job.id} completed`);
  });

  worker.on("error", (err) => {
    console.error(`[worker:${name}] error: ${err.message}`);
  });

  return worker;
}

// ---------------------------------------------------------------------------
// Pre-configured queues (lazy — only created when imported)
// ---------------------------------------------------------------------------

export const heartbeatQueue = createQueue("agent:heartbeat");
export const reasoningQueue = createQueue("agent:reasoning");
