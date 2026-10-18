import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
@Injectable()
export class DeploymentQueueService implements OnModuleDestroy {
  readonly queue: Queue;
  private readonly logger = new Logger("DeploymentQueue");
  constructor(config: ConfigService) {
    this.queue = new Queue("deployment-queue", {
      prefix: config.get("QUEUE_PREFIX", "bull"),
      connection: {
        host: config.getOrThrow("REDIS_HOST"),
        port: Number(config.get("REDIS_PORT", 6379)),
        connectTimeout: 2000,
        commandTimeout: 2500,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      },
      defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
    });
    this.queue.on("error", () =>
      this.logger.warn(
        "Queue connection unavailable; durable outbox will retry",
      ),
    );
  }
  async add(deploymentId: string, jobId: string) {
    await this.queue.add("deployment-requested", { deploymentId }, { jobId });
  }
  async onModuleDestroy() {
    await this.queue.close();
  }
}
