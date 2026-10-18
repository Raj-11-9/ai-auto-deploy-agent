import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;
  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.getOrThrow("REDIS_HOST"),
      port: Number(config.get("REDIS_PORT", 6379)),
      lazyConnect: true,
      connectTimeout: 2000,
      commandTimeout: 2000,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });
    this.client.on("error", () =>
      new Logger("Redis").warn("Redis connection unavailable"),
    );
    void this.client.connect().catch(() => undefined);
  }
  async ping(): Promise<void> {
    if ((await this.client.ping()) !== "PONG")
      throw new Error("Redis ping failed");
  }
  onModuleDestroy() {
    this.client.disconnect();
  }
}
