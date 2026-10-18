import {
  Controller,
  Get,
  Injectable,
  Module,
  ServiceUnavailableException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { RedisService } from "../../common/redis.service";
@Injectable()
export class HealthService {
  constructor(
    private readonly db: DataSource,
    private readonly redis: RedisService,
  ) {}
  async database() {
    try {
      await this.db.query("SELECT 1");
      return { status: "up" as const };
    } catch {
      return { status: "down" as const };
    }
  }
  async cache() {
    try {
      await this.redis.ping();
      return { status: "up" as const };
    } catch {
      return { status: "down" as const };
    }
  }
  async all() {
    const [database, redis] = await Promise.all([
      this.database(),
      this.cache(),
    ]);
    return {
      status: database.status === "up" && redis.status === "up" ? "up" : "down",
      services: { backend: { status: "up" }, database, redis },
      timestamp: new Date().toISOString(),
    };
  }
}
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}
  @Get() async all() {
    const result = await this.health.all();
    if (result.status === "down") throw new ServiceUnavailableException(result);
    return result;
  }
  @Get("database") async database() {
    const result = await this.health.database();
    if (result.status === "down") throw new ServiceUnavailableException(result);
    return result;
  }
  @Get("redis") async redis() {
    const result = await this.health.cache();
    if (result.status === "down") throw new ServiceUnavailableException(result);
    return result;
  }
}
@Module({
  controllers: [HealthController],
  providers: [HealthService, RedisService],
})
export class HealthModule {}
