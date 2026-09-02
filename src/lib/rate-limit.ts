import {
  RateLimiterRedis,
  RateLimiterRes,
} from "rate-limiter-flexible";
import IORedis from "ioredis";

/** Lazy so `/api/chat` import doesn’t open Redis unless someone actually chats. */
let redisClient: IORedis | null = null;
let rateLimiterRedis: RateLimiterRedis | null = null;

function getRateLimiterRedis(): RateLimiterRedis {
  if (rateLimiterRedis) return rateLimiterRedis;

  const redisUrl = process.env.REDIS_URL?.trim();
  redisClient =
    redisUrl && redisUrl.length > 0
      ? new IORedis(redisUrl, {
          maxRetriesPerRequest: null,
          connectTimeout: 1500,
          enableOfflineQueue: false,
          retryStrategy(times) {
            return Math.min(times * 250, 5_000);
          },
        })
      : new IORedis({
          host: "localhost",
          port: 6379,
          connectTimeout: 1500,
          enableOfflineQueue: false,
          retryStrategy(times) {
            return Math.min(times * 250, 5_000);
          },
        });

  redisClient.on("error", (err) => {
    console.error("[redis/ratelimit]", err.message);
  });

  rateLimiterRedis = new RateLimiterRedis({
    storeClient: redisClient,
    points: 30,
    duration: 60,
    blockDuration: 120,
    keyPrefix: "rl:chat",
  });

  return rateLimiterRedis;
}

export async function checkRateLimit(userId: string): Promise<
  { success: true } | { success: false; retryAfter: number; message: string }
> {
  try {
    await getRateLimiterRedis().consume(userId);
    return { success: true };
  } catch (e: unknown) {
    // Normal path: quota exceeded → RateLimiterRes
    if (e instanceof RateLimiterRes) {
      const retryAfter = Math.ceil((e.msBeforeNext || 60000) / 1000);
      return {
        success: false,
        retryAfter,
        message: `Rate limit exceeded. Try again in ${retryAfter}s.`,
      };
    }

    // Redis WRONGPASS, network, etc.: don’t brick chat with hard 500s in prod debugging.
    console.warn(
      "[rate-limit] Redis error; skipping limit for this request",
      e instanceof Error ? e.message : e,
    );
    return { success: true };
  }
}
