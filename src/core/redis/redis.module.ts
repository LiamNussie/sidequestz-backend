import { Global, Logger, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

export const REDIS = Symbol('REDIS');

const redisLogger = new Logger('Redis');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (appConfig: AppConfigService) => {
        const url = appConfig.getRedisUrl();
        const redis = new Redis(url, {
          maxRetriesPerRequest: null,
          /** Don’t connect until first command — avoids boot spam when Redis isn’t running yet. */
          lazyConnect: true,
          retryStrategy(times: number) {
            return Math.min(times * 500, 8_000);
          },
        });

        let lastErrLogMs = 0;
        redis.on('error', (err: Error) => {
          const now = Date.now();
          if (now - lastErrLogMs > 15_000) {
            lastErrLogMs = now;
            redisLogger.warn(
              `${err.message} (${url}). LynkFinder needs Redis in dev — e.g. docker run -d -p 6379:6379 redis:7-alpine`,
            );
          }
        });

        return redis;
      },
      inject: [AppConfigService],
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}

export type RedisClient = Redis;
