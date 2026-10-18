import "reflect-metadata";
import "dotenv/config";
import { DataSource, DataSourceOptions } from "typeorm";
import { Project, Deployment, DeploymentLog } from "./entities";
import { InitialSchema1792300000000 } from "./migrations/1792300000000-InitialSchema";
import { GitHubIntegration1792310000000 } from "./migrations/1792310000000-GitHubIntegration";
export function databaseOptions(): DataSourceOptions {
  return {
    type: "postgres",
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [Project, Deployment, DeploymentLog],
    migrations: [InitialSchema1792300000000, GitHubIntegration1792310000000],
    synchronize: false,
    migrationsRun: false,
    connectTimeoutMS: 3000,
    extra: {
      max: 10,
      connectionTimeoutMillis: 3000,
      statement_timeout: 3000,
      query_timeout: 4000,
    },
  };
}
export default new DataSource(databaseOptions());
