import { Controller, Get, Module } from "@nestjs/common";
import { InjectRepository, TypeOrmModule } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Deployment } from "../../database/entities";
@Controller("deployments")
export class DeploymentController {
  constructor(
    @InjectRepository(Deployment)
    private readonly repository: Repository<Deployment>,
  ) {}
  @Get() list() {
    return this.repository.find({ order: { created_at: "DESC" }, take: 100 });
  }
}
@Module({
  imports: [TypeOrmModule.forFeature([Deployment])],
  controllers: [DeploymentController],
})
export class DeploymentModule {}
