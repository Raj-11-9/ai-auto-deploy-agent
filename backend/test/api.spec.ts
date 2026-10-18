import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import request from "supertest";
import {
  HealthController,
  HealthService,
} from "../src/modules/health/health.module";
import { ProjectService } from "../src/modules/projects/project.service";
import { ManagementGuard } from "../src/common/management.guard";
import { ProjectController } from "../src/modules/projects/projects.module";
import { DeploymentController } from "../src/modules/deployments/deployments.module";
import { DashboardController } from "../src/modules/dashboard/dashboard.module";
import { Project, Deployment } from "../src/database/entities";
import { RedisService } from "../src/common/redis.service";
import { configureApp } from "../src/common/configure-app";
import { validateEnvironment } from "../src/config/environment";
describe("Application HTTP contracts (dependency doubles)", () => {
  let app: INestApplication;
  const summary = {
    totalProjects: 0,
    totalDeployments: 0,
    successfulDeployments: 0,
    failedDeployments: 0,
  };
  const db = { query: jest.fn() };
  const redis = { ping: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        HealthController,
        ProjectController,
        DeploymentController,
        DashboardController,
      ],
      providers: [
        HealthService,
        ManagementGuard,
        {
          provide: ProjectService,
          useValue: { list: jest.fn().mockResolvedValue([]) },
        },
        { provide: DataSource, useValue: db },
        { provide: RedisService, useValue: redis },
        {
          provide: getRepositoryToken(Project),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Deployment),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  beforeEach(() => {
    db.query
      .mockReset()
      .mockImplementation(async (sql: string) =>
        sql === "SELECT 1" ? [{ value: 1 }] : [summary],
      );
    redis.ping.mockReset().mockResolvedValue(undefined);
  });
  afterAll(async () => {
    await app.close();
  });
  it("starts and reports actual dependency probe results", async () => {
    const result = await request(app.getHttpServer())
      .get("/api/health")
      .expect(200);
    expect(result.body.services.database.status).toBe("up");
    expect(db.query).toHaveBeenCalledWith("SELECT 1");
    expect(redis.ping).toHaveBeenCalled();
  });
  it.each(["/api/health/database", "/api/health/redis"])(
    "checks %s",
    async (path) => {
      await request(app.getHttpServer())
        .get(path)
        .expect(200, { status: "up" });
    },
  );
  it("reports database failure with 503", async () => {
    db.query.mockRejectedValue(new Error("offline"));
    await request(app.getHttpServer()).get("/api/health/database").expect(503);
    const result = await request(app.getHttpServer())
      .get("/api/health")
      .expect(503);
    expect(result.body.error.services.database.status).toBe("down");
  });
  it("reports redis failure with 503", async () => {
    redis.ping.mockRejectedValue(new Error("offline"));
    await request(app.getHttpServer()).get("/api/health/redis").expect(503);
  });
  it.each(["/api/projects", "/api/deployments"])(
    "returns empty records at %s",
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(200, []);
    },
  );
  it("returns database summary counts", async () => {
    await request(app.getHttpServer())
      .get("/api/dashboard/summary")
      .expect(200, summary);
  });
  it("does not mask query failure as zero counts", async () => {
    db.query.mockRejectedValue(new Error("private-db-error"));
    const result = await request(app.getHttpServer())
      .get("/api/dashboard/summary")
      .expect(500);
    expect(result.body.error).toBe("Internal server error");
  });
  it("restricts CORS to the frontend", async () => {
    const result = await request(app.getHttpServer())
      .get("/api/projects")
      .set("Origin", "http://localhost:5173")
      .expect(200);
    expect(result.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
  });
  it.each(["http://localhost:5173", "http://127.0.0.1:5173"])(
    "permits local frontend requests and authenticated preflight from %s",
    async origin => {
      const response = await request(app.getHttpServer()).get("/api/projects").set("Origin", origin).expect(200);
      expect(response.headers["access-control-allow-origin"]).toBe(origin);
      const preflight = await request(app.getHttpServer()).options("/api/projects")
        .set("Origin", origin).set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "authorization,content-type").expect(204);
      expect(preflight.headers["access-control-allow-origin"]).toBe(origin);
      expect(preflight.headers["access-control-allow-headers"]).toContain("authorization");
    }
  );
  it("does not allow an unrelated browser origin", async () => {
    const response = await request(app.getHttpServer()).get("/api/projects").set("Origin", "https://unrelated.example").expect(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
  it("rejects missing configuration", () => {
    expect(() => validateEnvironment({})).toThrow(
      "Missing environment variable",
    );
  });
});
