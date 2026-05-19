/**
 * A Tranquil Space — background worker.
 *
 * Runs on Railway as a separate process. Three pipelines:
 *   transcribe  -> Grok STT, writes transcript to note
 *   organize    -> Grok 4.1 Fast tags/title/summary, enqueues embed
 *   embed       -> uploads note to user's Grok Collection, links related notes
 *
 * Start locally: pnpm worker:dev
 * Start in prod: pnpm worker
 */
import "dotenv/config";
import { Worker } from "bullmq";
import { redisConnection, QUEUES } from "../src/lib/queue";
import { transcribeProcessor } from "./jobs/transcribe";
import { organizeProcessor } from "./jobs/organize";
import { embedProcessor } from "./jobs/embed";

const workers = [
  new Worker(QUEUES.transcribe, transcribeProcessor, {
    ...redisConnection,
    concurrency: 4,
  }),
  new Worker(QUEUES.organize, organizeProcessor, {
    ...redisConnection,
    concurrency: 6,
  }),
  new Worker(QUEUES.embed, embedProcessor, {
    ...redisConnection,
    concurrency: 4,
  }),
];

for (const w of workers) {
  w.on("completed", (job) => {
    console.log(`[${w.name}] done ${job.id}`);
  });
  w.on("failed", (job, err) => {
    console.error(`[${w.name}] failed ${job?.id}: ${err.message}`);
  });
}

console.log("Worker started. Listening on: transcribe, organize, embed.");

async function shutdown() {
  console.log("Shutting down workers…");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}
process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);
