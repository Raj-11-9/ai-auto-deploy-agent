import { ValidateIf, IsString, Length, Matches, IsIn } from "class-validator";
export class CreateProjectDto {
  @IsString()
  @Matches(
    /^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/,
  )
  @Length(20, 250)
  repository_url!: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  name?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Length(1, 200)
  branch?: string;
}
export class UpdateProjectDto extends CreateProjectDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(
    /^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/,
  )
  @Length(20, 250)
  declare repository_url: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(["connected", "disconnected"])
  status?: string;
}
