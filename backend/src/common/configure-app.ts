import { INestApplication, ValidationPipe } from "@nestjs/common";
import { HttpErrorFilter } from "./http-error.filter";
export function configureApp(app: INestApplication) {
  // Register before Nest's default parser, keeping exact bytes for signed JSON.
  (
    app as import("@nestjs/platform-express").NestExpressApplication
  ).useBodyParser("json", { limit: "1mb", inflate: false });
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: frontendOrigins(),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableShutdownHooks();
}

// Browsers treat localhost and 127.0.0.1 as different origins.
// Permit their equivalent local development URL without allowing arbitrary origins.
export function frontendOrigins(): string[] {
  const configured = process.env.FRONTEND_URL || "http://localhost:5173";
  const origins = new Set([configured]);
  const url = new URL(configured);
  if (process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname)) {
    url.hostname = url.hostname === "localhost" ? "127.0.0.1" : "localhost";
    origins.add(url.origin);
  }
  return [...origins];
}
