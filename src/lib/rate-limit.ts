import { RateLimiterRedis } from 'rate-limiter-flexible';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL;
const redisClient = redisUrl
  ? new IORedis(redisUrl, { maxRetriesPerRequest: null })
  : new IORedis({ host: 'localhost', port: 6379, maxRetriesPerRequest: null });

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 30,           // 30 requests
  duration: 60,         // per 60 seconds (per user)
  blockDuration: 120,   // block for 2min on exceed
  keyPrefix: 'rl:chat',
});

export async function checkRateLimit(userId: string): Promise<{ success: true } | { success: false; retryAfter: number; message: string }> {
  try {
    await rateLimiter.consume(userId);
    return { success: true };
  } catch (rejRes: any) {
    const retryAfter = Math.ceil((rejRes.msBeforeNext || 60000) / 1000);
    return {
      success: false,
      retryAfter,
      message: `Rate limit exceeded. Try again in ${retryAfter}s.`,
    };
  }
}
