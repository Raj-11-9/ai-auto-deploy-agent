import { Controller, Get, Module } from "@nestjs/common";
import { DataSource } from "typeorm";
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly db: DataSource) {}
  @Get("summary") async summary() {
    const [row] = await this.db
      .query(`SELECT (SELECT count(*)::int FROM projects) AS "totalProjects",
      count(*)::int AS "totalDeployments", count(*) FILTER (WHERE status = 'success')::int AS "successfulDeployments",
      count(*) FILTER (WHERE status = 'failed')::int AS "failedDeployments" FROM deployments`);
    return row;
  }
}
@Module({ controllers: [DashboardController] })
export class DashboardModule {}
