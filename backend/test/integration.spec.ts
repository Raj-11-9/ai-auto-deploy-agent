import "reflect-metadata";
import "dotenv/config";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/common/configure-app";
describe("Live PostgreSQL and Redis integration (requires migrated services)", () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  }, 30000);
  afterAll(async () => {
    if (app) await app.close();
  });
  it.each([
    "/api/health",
    "/api/health/database",
    "/api/health/redis",
    "/api/projects",
    "/api/deployments",
  ])("serves %s with real dependencies", async (path) => {
    await request(app.getHttpServer()).get(path).expect(200);
  });
  it("matches actual database counts", async () => {
    const db = app.get(DataSource);
    const [projects] = await db.query(
      "SELECT count(*)::int AS count FROM projects",
    );
    const [deployments] = await db.query(
      "SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'success')::int AS success, count(*) FILTER (WHERE status = 'failed')::int AS failed FROM deployments",
    );
    const response = await request(app.getHttpServer())
      .get("/api/dashboard/summary")
      .expect(200);
    expect(response.body).toEqual({
      totalProjects: projects.count,
      totalDeployments: deployments.total,
      successfulDeployments: deployments.success,
      failedDeployments: deployments.failed,
    });
  });
});
