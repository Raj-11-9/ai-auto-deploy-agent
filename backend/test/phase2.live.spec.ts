import "reflect-metadata";
import "dotenv/config";
import { randomBytes, randomUUID, createHmac } from "crypto";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { databaseOptions } from "../src/database/data-source";
import { GitHubRepositoryService } from "../src/modules/projects/github-repository.service";
import { DeploymentQueueService } from "../src/modules/queue/deployment-queue.service";
import { OutboxService } from "../src/modules/queue/outbox.service";
import { configureApp } from "../src/common/configure-app";
describe("Phase 2 isolated PostgreSQL + Redis HTTP integration", () => {
  let app: INestApplication;
  let db: DataSource;
  let admin: DataSource;
  let queue: DeploymentQueueService;
  let outbox: OutboxService;
  let projectId: string;
  const schema = "phase2_test_" + randomBytes(8).toString("hex");
  const prefix = "phase2test" + randomBytes(8).toString("hex");
  const previousPrefix = process.env.QUEUE_PREFIX;
  const repositoryId = 900000000000001;
  const metadata = {
    id: String(repositoryId),
    owner: "integration-fixture",
    name: "fixture",
    url: "https://github.com/integration-fixture/fixture",
  };
  const lookup = jest.fn().mockResolvedValue(metadata);
  const token = () => "Bearer " + process.env.MANAGEMENT_API_TOKEN;
  const push = (sha = "a".repeat(40), ref = "refs/heads/master") => ({
    repository: { id: repositoryId },
    ref,
    after: sha,
    deleted: false,
  });
  function send(
    body: any,
    id: string = randomUUID(),
    event = "push",
    signature?: string,
  ) {
    const raw = typeof body === "string" ? body : JSON.stringify(body);
    const hmac =
      signature ??
      "sha256=" +
        createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET!)
          .update(raw)
          .digest("hex");
    return request(app.getHttpServer())
      .post("/api/webhooks/github")
      .set("Content-Type", "application/json")
      .set("X-GitHub-Event", event)
      .set("X-GitHub-Delivery", id)
      .set("X-Hub-Signature-256", hmac)
      .send(raw);
  }
  beforeAll(async () => {
    if (!/^phase2_test_[a-f0-9]+$/.test(schema))
      throw new Error("Unsafe test schema");
    admin = new DataSource(databaseOptions());
    await admin.initialize();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    db = new DataSource({
      ...databaseOptions(),
      schema,
      extra: {
        options: `-c search_path=${schema},public`,
        connectionTimeoutMillis: 3000,
        statement_timeout: 3000,
      },
    } as any);
    await db.initialize();
    await db.runMigrations();
    process.env.QUEUE_PREFIX = prefix;
    const start = jest
      .spyOn(OutboxService.prototype, "onModuleInit")
      .mockImplementation(() => undefined);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource)
      .useValue(db)
      .overrideProvider(GitHubRepositoryService)
      .useValue({ resolve: lookup })
      .compile();
    app = module.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    start.mockRestore();
    queue = app.get(DeploymentQueueService);
    outbox = app.get(OutboxService);
    await queue.queue.waitUntilReady();
  }, 30000);
  beforeEach(async () => {
    await queue.queue.obliterate({ force: true });
    await db.query(
      "TRUNCATE webhook_deliveries,deployment_outbox,deployment_logs,deployments,projects CASCADE",
    );
    lookup.mockReset().mockResolvedValue(metadata);
    const result = await request(app.getHttpServer())
      .post("/api/projects")
      .set("Authorization", token())
      .send({ repository_url: metadata.url })
      .expect(201);
    projectId = result.body.id;
  });
  afterAll(async () => {
    if (queue) await queue.queue.obliterate({ force: true });
    if (app) await app.close();
    if (db?.isInitialized) await db.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.destroy();
    }
    if (previousPrefix === undefined) delete process.env.QUEUE_PREFIX;
    else process.env.QUEUE_PREFIX = previousPrefix;
  });
  it("registers stable public GitHub identity with default master", async () => {
    const result = await request(app.getHttpServer())
      .get("/api/projects/" + projectId)
      .expect(200);
    expect(result.body.github_repository_id).toBe(String(repositoryId));
    expect(result.body.branch).toBe("master");
    expect(JSON.stringify(result.body)).not.toContain(
      process.env.MANAGEMENT_API_TOKEN,
    );
  });
  it("rejects duplicate repository registrations", async () => {
    await request(app.getHttpServer())
      .post("/api/projects")
      .set("Authorization", token())
      .send({ repository_url: metadata.url + ".git" })
      .expect(409);
  });
  it.each([
    { repository_url: "https://evil.example/owner/repo" },
    { repository_url: metadata.url, branch: "bad branch" },
    { repository_url: metadata.url, name: null },
    { repository_url: metadata.url, unknown: "field" },
  ])("validates project input %j", async (body) => {
    await request(app.getHttpServer())
      .post("/api/projects")
      .set("Authorization", token())
      .send(body)
      .expect(400);
  });
  it("requires authentication for project changes", async () => {
    await request(app.getHttpServer())
      .post("/api/projects")
      .send({ repository_url: metadata.url })
      .expect(401);
    await request(app.getHttpServer())
      .delete("/api/projects/" + projectId)
      .expect(401);
  });
  it("supports PATCH branch and rejects changes to repository identity", async () => {
    await request(app.getHttpServer())
      .patch("/api/projects/" + projectId)
      .set("Authorization", token())
      .send({ branch: "main", name: "Updated" })
      .expect(200);
    await send(push())
      .expect(202)
      .expect((r) => expect(r.body.reason).toBe("unconfigured_branch"));
    await send(push("b".repeat(40), "refs/heads/main"))
      .expect(202)
      .expect((r) => expect(r.body.status).toBe("accepted"));
    lookup.mockResolvedValue({ ...metadata, id: "42" });
    await request(app.getHttpServer())
      .patch("/api/projects/" + projectId)
      .set("Authorization", token())
      .send({ repository_url: metadata.url })
      .expect(400);
  });
  it("creates a queued deployment and real BullMQ job on master", async () => {
    const response = await send(push()).expect(202);
    expect(response.body.status).toBe("accepted");
    await outbox.dispatch();
    const [deployment] = await db.query("SELECT * FROM deployments");
    expect(deployment.status).toBe("queued");
    expect(deployment.trigger_type).toBe("github_push");
    expect(deployment.started_at).toBeNull();
    const job = await queue.queue.getJob(deployment.queue_job_id);
    expect(job?.data.deploymentId).toBe(deployment.id);
    expect(await job?.getState()).toBe("waiting");
    const [delivery] = await db.query("SELECT * FROM webhook_deliveries");
    expect(delivery.reason).toBe("dispatched");
    expect(delivery.processed_at).toBeTruthy();
  });
  it("verifies exact raw bytes including whitespace", async () => {
    await send(JSON.stringify(push(), null, 2))
      .expect(202)
      .expect((r) => expect(r.body.status).toBe("accepted"));
  });
  it("rejects invalid signatures without writing delivery data", async () => {
    await send(push(), randomUUID(), "push", "sha256=" + "0".repeat(64)).expect(
      401,
    );
    expect(await db.query("SELECT * FROM webhook_deliveries")).toHaveLength(0);
  });
  it("rejects missing signatures", async () => {
    await request(app.getHttpServer())
      .post("/api/webhooks/github")
      .send(push())
      .expect(401);
  });
  it("ignores another branch", async () => {
    await send(push("a".repeat(40), "refs/heads/other"))
      .expect(202)
      .expect((r) => expect(r.body.reason).toBe("unconfigured_branch"));
    expect(await db.query("SELECT * FROM deployments")).toHaveLength(0);
  });
  it("ignores unknown repository even when its name matches", async () => {
    await send({ ...push(), repository: { id: 123, name: "fixture" } })
      .expect(202)
      .expect((r) => expect(r.body.reason).toBe("unknown_repository"));
  });
  it("deduplicates same delivery and different delivery for same commit", async () => {
    const id = randomUUID();
    const first = await send(push(), id).expect(202);
    await send(push(), id)
      .expect(202)
      .expect((r) => expect(r.body.status).toBe("duplicate"));
    const duplicate = await send(push()).expect(202);
    expect(duplicate.body.reason).toBe("duplicate_commit");
    expect(duplicate.body.deploymentId).toBe(first.body.deploymentId);
    expect(await db.query("SELECT * FROM deployments")).toHaveLength(1);
    expect(await db.query("SELECT * FROM deployment_outbox")).toHaveLength(1);
  });
  it("deduplicates concurrent deliveries and commits", async () => {
    const id = randomUUID();
    await Promise.all([
      send(push(), id).expect(202),
      send(push(), id).expect(202),
      send(push()).expect(202),
    ]);
    expect(await db.query("SELECT * FROM deployments")).toHaveLength(1);
  });
  it("rejects reuse of a delivery ID for a different payload", async () => {
    const id = randomUUID();
    await send(push(), id).expect(202);
    await send(push("b".repeat(40)), id).expect(409);
  });
  it("ignores branch deletion and all-zero commit", async () => {
    await send({ ...push(), deleted: true })
      .expect(202)
      .expect((r) => expect(r.body.reason).toBe("branch_deleted"));
    await send(push("0".repeat(40)))
      .expect(202)
      .expect((r) => expect(r.body.reason).toBe("branch_deleted"));
  });
  it("acknowledges unsupported events without queueing", async () => {
    await send({ zen: "fixture" }, randomUUID(), "ping")
      .expect(202)
      .expect((r) => expect(r.body.reason).toBe("unsupported_event"));
    expect(await db.query("SELECT * FROM deployment_outbox")).toHaveLength(0);
  });
  it("rejects invalid event headers, payloads and oversized requests", async () => {
    await send(push(), "invalid-id").expect(400);
    await send({}, randomUUID(), "push").expect(400);
    await send(push(), randomUUID(), "INVALID EVENT").expect(400);
    await send({ ...push(), padding: "x".repeat(1024 * 1024) }).expect(413);
  });
  it("retains durable pending request after queue failure and recovers", async () => {
    await send(push()).expect(202);
    const insert = jest
      .spyOn(queue, "add")
      .mockRejectedValueOnce(new Error("redis unavailable"));
    await outbox.dispatch();
    const [pending] = await db.query("SELECT * FROM deployment_outbox");
    expect(pending.dispatched_at).toBeNull();
    expect(pending.attempts).toBe(1);
    insert.mockRestore();
    await outbox.dispatch();
    const [sent] = await db.query("SELECT * FROM deployment_outbox");
    expect(sent.dispatched_at).not.toBeNull();
    expect(await queue.queue.getJob(sent.job_id)).toBeTruthy();
  });
  it("recovers when Redis accepted a job but acknowledgement was lost", async () => {
    await send(push()).expect(202);
    const add = queue.add.bind(queue);
    const insert = jest
      .spyOn(queue, "add")
      .mockImplementationOnce(async (id, job) => {
        await add(id, job);
        throw new Error("ack lost");
      });
    await outbox.dispatch();
    insert.mockRestore();
    await outbox.dispatch();
    expect(await queue.queue.getWaitingCount()).toBe(1);
    expect((await db.query("SELECT * FROM deployments"))[0].status).toBe(
      "queued",
    );
  });
  it("database rollback leaves no partial deployment or delivery", async () => {
    await db.query(
      "ALTER TABLE deployment_outbox ADD CONSTRAINT test_dispatch_failure CHECK (job_id = 'cannot-match')",
    );
    const id = randomUUID();
    try {
      await send(push(), id).expect(500);
      expect(await db.query("SELECT * FROM deployments")).toHaveLength(0);
      expect(await db.query("SELECT * FROM webhook_deliveries")).toHaveLength(
        0,
      );
    } finally {
      await db.query(
        "ALTER TABLE deployment_outbox DROP CONSTRAINT test_dispatch_failure",
      );
    }
    await send(push(), id).expect(202);
    expect(await db.query("SELECT * FROM deployments")).toHaveLength(1);
  });
  it("archives projects without deleting deployment history", async () => {
    await send(push()).expect(202);
    await request(app.getHttpServer())
      .delete("/api/projects/" + projectId)
      .set("Authorization", token())
      .expect(204);
    await request(app.getHttpServer())
      .get("/api/projects/" + projectId)
      .expect(404);
    await request(app.getHttpServer()).get("/api/projects").expect(200, []);
    expect(await db.query("SELECT * FROM deployments")).toHaveLength(1);
    await send(push("c".repeat(40)))
      .expect(202)
      .expect((r) => expect(r.body.reason).toBe("unknown_repository"));
  });
});
