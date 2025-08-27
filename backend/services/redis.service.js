import Redis from 'ioredis';

// Ensure the REDIS_URL environment variable is set.
if (!process.env.REDIS_URL) {
  throw new Error("FATAL ERROR: REDIS_URL is not defined in environment variables.");
}

// ioredis can parse the connection URL directly.
const redisClient = new Redis(process.env.REDIS_URL);

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully.');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

export default redisClient;
