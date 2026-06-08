import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

// Mutable reference — set to null if Redis is unavailable.
let redisClient: RedisClientType | null = null;

async function connectRedis(): Promise<void> {
  const logger = new Logger('CacheModule');
  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || '6379';

  const client = createClient({
    url: `redis://${host}:${port}`,
  }) as RedisClientType;

  client.on('error', (err: Error) =>
    logger.warn(`Redis error (non-fatal): ${err.message}`),
  );

  try {
    await client.connect();
    redisClient = client;
    logger.log('Connected to Redis');
  } catch {
    logger.warn('Redis unavailable – running without cache');
    redisClient = null;
  }
}

// Provider value factory — returns the mutable reference wrapper so
// consumers always see the current value (null or live client).
export const redisClientRef = { get client(): RedisClientType | null { return redisClient; } };

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useValue: redisClientRef,
    },
  ],
  exports: [REDIS_CLIENT],
})
export class CacheModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await connectRedis();
  }
}
