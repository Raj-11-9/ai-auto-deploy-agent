import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { validateEnvironment } from "./config/environment";
import { databaseOptions } from "./database/data-source";
import { HealthModule } from "./modules/health/health.module";
import { ProjectModule } from "./modules/projects/projects.module";
import { DeploymentModule } from "./modules/deployments/deployments.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...databaseOptions(),
        retryAttempts: 3,
        retryDelay: 1000,
      }),
    }),
    WebhooksModule,
    HealthModule,
    ProjectModule,
    DeploymentModule,
    DashboardModule,
  ],
})
export class AppModule {}
