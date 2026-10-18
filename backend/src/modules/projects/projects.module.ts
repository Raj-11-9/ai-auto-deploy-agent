import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Project } from "../../database/entities";
import { ManagementGuard } from "../../common/management.guard";
import { ProjectService } from "./project.service";
import { GitHubRepositoryService } from "./github-repository.service";
import { CreateProjectDto, UpdateProjectDto } from "./project.dto";
@Controller("projects")
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}
  @Get() list() {
    return this.projects.list();
  }
  @Get(":id") get(@Param("id", ParseUUIDPipe) id: string) {
    return this.projects.get(id);
  }
  @Post() @UseGuards(ManagementGuard) create(@Body() dto: CreateProjectDto) {
    return this.projects.create(dto);
  }
  @Patch(":id") @UseGuards(ManagementGuard) update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(id, dto);
  }
  @Delete(":id") @HttpCode(204) @UseGuards(ManagementGuard) remove(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.projects.remove(id);
  }
}
@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  controllers: [ProjectController],
  providers: [ProjectService, GitHubRepositoryService, ManagementGuard],
})
export class ProjectModule {}
