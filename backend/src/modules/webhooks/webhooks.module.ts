import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Module,
  Post,
  RawBodyRequest,
  Req,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { verifyGitHubSignature } from "./signature";
import { WebhookService } from "./webhook.service";
import { DeploymentQueueService } from "../queue/deployment-queue.service";
import { OutboxService } from "../queue/outbox.service";
@Controller("webhooks")
export class WebhookController {
  constructor(
    private readonly service: WebhookService,
    private readonly config: ConfigService,
  ) {}
  @Post("github")
  @HttpCode(202)
  async github(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-hub-signature-256") signature: string,
    @Headers("x-github-event") event: string,
    @Headers("x-github-delivery") delivery: string,
  ) {
    const hash = verifyGitHubSignature(
      req.rawBody,
      signature,
      this.config.getOrThrow("GITHUB_WEBHOOK_SECRET"),
    );
    if (!req.is("application/json"))
      throw new UnsupportedMediaTypeException("Use application/json");
    if (
      typeof event !== "string" ||
      !/^[a-z][a-z0-9_]{0,63}$/.test(event) ||
      typeof delivery !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        delivery,
      )
    )
      throw new BadRequestException("Invalid GitHub event headers");
    return this.service.receive(delivery, hash, event, req.body);
  }
}
@Module({
  controllers: [WebhookController],
  providers: [WebhookService, DeploymentQueueService, OutboxService],
})
export class WebhooksModule {}
