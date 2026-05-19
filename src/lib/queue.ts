import { Queue, type QueueBaseOptions } from "bullmq";
import IORedis from "ioredis";

const url = process.env.REDIS_URL;
if (!url && process.env.NODE_ENV === "production") {
  // eslint-disable-next-line no-console
  console.warn("REDIS_URL not set; queue features will fail.");
}

const redisConn = url
  ? new IORedis(url, { maxRetriesPerRequest: null })
  : new IORedis({ host: "localhost", port: 6379, maxRetriesPerRequest: null });

/** BullMQ expects `{ connection: Redis | RedisOptions }` — not `ConnectionOptions` alone. */
export const redisConnection: Pick<QueueBaseOptions, "connection"> = {
  connection: redisConn,
};

export const QUEUES = {
  transcribe: "transcribe",
  organize:   "organize",
  embed:      "embed",
} as const;

export type TranscribeJob = { noteId: string };
export type OrganizeJob   = { noteId: string };
export type EmbedJob      = { noteId: string };

// Singletons - safe across HMR
type GlobalQueues = {
  transcribeQueue?: Queue<TranscribeJob>;
  organizeQueue?:   Queue<OrganizeJob>;
  embedQueue?:      Queue<EmbedJob>;
};
const g = globalThis as unknown as GlobalQueues;

export const transcribeQueue: Queue<TranscribeJob> =
  g.transcribeQueue ??
  (g.transcribeQueue = new Queue<TranscribeJob>(QUEUES.transcribe, redisConnection));

export const organizeQueue: Queue<OrganizeJob> =
  g.organizeQueue ??
  (g.organizeQueue = new Queue<OrganizeJob>(QUEUES.organize, redisConnection));

export const embedQueue: Queue<EmbedJob> =
  g.embedQueue ??
  (g.embedQueue = new Queue<EmbedJob>(QUEUES.embed, redisConnection));

/**
 * Enqueue an organize job with debounce: subsequent calls within `delayMs` for
 * the same noteId replace the pending job rather than running both.
 */
export async function enqueueOrganize(noteId: string, delayMs = 30_000) {
  const jobId = `organize:${noteId}`;
  try {
    await organizeQueue.remove(jobId);
  } catch { /* job may not exist */ }
  return organizeQueue.add(QUEUES.organize, { noteId }, { jobId, delay: delayMs });
}
