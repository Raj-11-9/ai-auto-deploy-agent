import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { DeploymentQueueService } from "./deployment-queue.service";
@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private stopped = false;
  private readonly logger = new Logger("Outbox");
  constructor(
    private readonly db: DataSource,
    private readonly queue: DeploymentQueueService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => void this.dispatch(), 2000);
    this.timer.unref();
    void this.dispatch();
  }
  async dispatch(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = this.drain();
    try {
      await this.running;
    } finally {
      this.running = undefined;
    }
  }
  private async drain() {
    try {
      for (let i = 0; i < 25 && !this.stopped; i++) {
        const found = await this.db.transaction(async (tx) => {
          const [row] = await tx.query(
            `SELECT deployment_id,job_id FROM deployment_outbox WHERE dispatched_at IS NULL ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`,
          );
          if (!row) return false;
          await tx.query(
            "UPDATE deployment_outbox SET attempts=attempts+1,last_attempt_at=now() WHERE deployment_id=$1",
            [row.deployment_id],
          );
          try {
            await this.queue.add(row.deployment_id, row.job_id);
          } catch {
            return "retry";
          }
          await tx.query(
            "UPDATE deployment_outbox SET dispatched_at=now() WHERE deployment_id=$1",
            [row.deployment_id],
          );
          await tx.query(
            "UPDATE webhook_deliveries SET reason='dispatched',processed_at=now() WHERE deployment_id=$1 AND state='accepted'",
            [row.deployment_id],
          );
          return true;
        });
        if (found === "retry") {
          this.logger.warn("Queue dispatch deferred; durable request retained");
          break;
        }
        if (!found) break;
      }
    } catch {
      this.logger.warn("Outbox dispatch unavailable; will retry");
    }
  }
  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
