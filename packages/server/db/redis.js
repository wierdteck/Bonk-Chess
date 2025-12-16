import { createClient } from 'redis';

export const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        return new Error('Redis reconnection failed');
      }
      return retries * 100; // Exponential backoff
    }
  }
});

redis.on("error", (err) => console.error("❌ Redis error:", err.message));
redis.on("connect", () => console.log("🔄 Redis connecting..."));
redis.on("ready", () => console.log("✅ Redis connected successfully"));
redis.on("reconnecting", () => console.log("🔄 Redis reconnecting..."));

// Connect to Redis
(async () => {
  try {
    await redis.connect();
  } catch (err) {
    console.error("❌ Redis connection failed:", err.message);
    console.log('⚠️ Continuing with in-memory sessions');
  }
})();