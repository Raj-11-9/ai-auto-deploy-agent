import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Project } from "../../database/entities";
import { CreateProjectDto, UpdateProjectDto } from "./project.dto";
import { GitHubRepositoryService } from "./github-repository.service";
export function validateBranch(branch: string): string {
  if (
    !branch ||
    branch.length > 200 ||
    branch === "@" ||
    branch.startsWith("-") ||
    /[\x00-\x20\x7f~^:?*\[\\]/.test(branch) ||
    branch.includes("..") ||
    branch.includes("@{") ||
    branch
      .split("/")
      .some(
        (p) =>
          !p || p.startsWith(".") || p.endsWith(".") || p.endsWith(".lock"),
      )
  )
    throw new BadRequestException("Invalid Git branch");
  return branch;
}
@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project) private readonly repository: Repository<Project>,
    private readonly github: GitHubRepositoryService,
  ) {}
  list() {
    return this.repository.find({
      where: [{ status: "connected" }, { status: "disconnected" }],
      order: { created_at: "DESC" },
      take: 100,
    });
  }
  async get(id: string) {
    const project = await this.repository.findOneBy({ id });
    if (!project || project.status === "archived")
      throw new NotFoundException("Project not found");
    return project;
  }
  async create(dto: CreateProjectDto) {
    const repo = await this.github.resolve(dto.repository_url);
    const project = this.repository.create({
      name: dto.name?.trim() || repo.name,
      branch: validateBranch(dto.branch ?? "master"),
      repository_url: repo.url,
      github_repository_id: repo.id,
      repository_owner: repo.owner,
      repository_name: repo.name,
      status: "connected",
    });
    return this.save(project);
  }
  async update(id: string, dto: UpdateProjectDto) {
    const project = await this.get(id);
    if (dto.repository_url !== undefined) {
      const repo = await this.github.resolve(dto.repository_url);
      if (
        project.github_repository_id &&
        project.github_repository_id !== repo.id
      )
        throw new BadRequestException(
          "Repository identity cannot change; register a new project",
        );
      Object.assign(project, {
        repository_url: repo.url,
        github_repository_id: repo.id,
        repository_owner: repo.owner,
        repository_name: repo.name,
      });
    }
    if (dto.branch !== undefined) project.branch = validateBranch(dto.branch);
    if (dto.name !== undefined) {
      if (!dto.name.trim())
        throw new BadRequestException("Name cannot be blank");
      project.name = dto.name.trim();
    }
    if (dto.status !== undefined) project.status = dto.status;
    return this.save(project);
  }
  async remove(id: string) {
    const project = await this.get(id);
    project.status = "archived";
    await this.save(project);
  }
  private async save(project: Project) {
    try {
      return await this.repository.save(project);
    } catch (e: any) {
      if (e.code === "23505")
        throw new ConflictException(
          "Repository already registered (including archived projects)",
        );
      throw e;
    }
  }
}
