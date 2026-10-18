import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { configureApp } from "./common/configure-app";
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app);
  await app.listen(Number(process.env.PORT || 4000), "127.0.0.1");
  new Logger("Bootstrap").log(
    `API listening on http://localhost:${process.env.PORT || 4000}/api`,
  );
}
bootstrap().catch((error) => {
  new Logger("Bootstrap").error(error);
  process.exitCode = 1;
});
