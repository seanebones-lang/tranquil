import { Queue, type QueueBaseOptions } from "bullmq";
import IORedis from "ioredis";

export const QUEUES = {
  transcribe: "transcribe",
  organize: "organize",
  embed: "embed",
} as const;

export type TranscribeJob = { noteId: string };
export type OrganizeJob = { noteId: string };
export type EmbedJob = { noteId: string };

/** Shared Redis for BullMQ (web enqueues jobs; worker runs processors). */
function createRedis(): IORedis {
  const url = process.env.REDIS_URL?.trim();

  const client =
    url && url.length > 0
      ? new IORedis(url, {
          maxRetriesPerRequest: null,
          retryStrategy(times) {
            return Math.min(times * 250, 5_000);
          },
        })
      : new IORedis({
          host: "localhost",
          port: 6379,
          maxRetriesPerRequest: null,
          retryStrategy(times) {
            return Math.min(times * 250, 5_000);
          },
        });

  client.on("error", (err) => {
    // eslint-disable-next-line no-console -- hosting visibility (Railway Redis WRONGPASS, etc.)
    console.error("[redis/bullmq]", err.message);
  });

  return client;
}

let _redisSingleton: IORedis | null = null;

/**
 * Lazy singleton — avoids connecting to Redis until a queue/job actually runs.
 * Wrong REDIS_URL on Railway should be fixed at source; this keeps logs clearer.
 */
export function getQueueRedis(): IORedis {
  if (!_redisSingleton) _redisSingleton = createRedis();
  return _redisSingleton;
}

/** BullMQ Worker spread target: `{ ...redisConnection }` */
export const redisConnection: Pick<QueueBaseOptions, "connection"> = {
  get connection() {
    return getQueueRedis();
  },
};

type GlobalQueues = {
  transcribeQueue?: Queue<TranscribeJob>;
  organizeQueue?: Queue<OrganizeJob>;
  embedQueue?: Queue<EmbedJob>;
};
const g = globalThis as unknown as GlobalQueues;

function getOrganizeQueue(): Queue<OrganizeJob> {
  return (
    g.organizeQueue ??
    (g.organizeQueue = new Queue<OrganizeJob>(
      QUEUES.organize,
      redisConnection,
    ))
  );
}

function getTranscribeQueue(): Queue<TranscribeJob> {
  return (
    g.transcribeQueue ??
    (g.transcribeQueue = new Queue<TranscribeJob>(
      QUEUES.transcribe,
      redisConnection,
    ))
  );
}

export function getEmbedQueue(): Queue<EmbedJob> {
  return (
    g.embedQueue ??
    (g.embedQueue = new Queue<EmbedJob>(QUEUES.embed, redisConnection))
  );
}

/**
 * Enqueue an organize job with debounce: subsequent calls within `delayMs` for
 * the same noteId replace the pending job rather than running both.
 */
export async function enqueueOrganize(noteId: string, delayMs = 30_000) {
  const organizeQueue = getOrganizeQueue();
  const jobId = `organize:${noteId}`;
  try {
    await organizeQueue.remove(jobId);
  } catch {
    /* job may not exist */
  }
  return organizeQueue.add(QUEUES.organize, { noteId }, { jobId, delay: delayMs });
}

export async function enqueueTranscribe(noteId: string) {
  const q = getTranscribeQueue();
  return q.add(
    QUEUES.transcribe,
    { noteId },
    {
      jobId: `transcribe:${noteId}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 2_000 },
    },
  );
}
