import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
export interface GitHubRepository {
  id: string;
  owner: string;
  name: string;
  url: string;
}
// Public metadata adapter; replace with a GitHub App adapter for private repositories later.
@Injectable()
export class GitHubRepositoryService {
  async resolve(url: string): Promise<GitHubRepository> {
    const match =
      /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)\/?$/.exec(
        url,
      );
    if (!match)
      throw new BadRequestException(
        "Use an HTTPS github.com owner/repository URL",
      );
    const owner = match[1];
    const name = match[2].replace(/\.git$/, "");
    if (!name || name === "." || name === "..")
      throw new BadRequestException("Invalid repository name");
    let response: Response;
    try {
      response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "AI-Auto-Deploy-Agent",
          },
          signal: AbortSignal.timeout(5000),
          redirect: "error",
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        "GitHub repository lookup unavailable",
      );
    }
    if (response.status === 404)
      throw new NotFoundException("Public GitHub repository not found");
    if (response.status === 403 || response.status === 429)
      throw new ServiceUnavailableException(
        "GitHub lookup rate limit reached; retry later",
      );
    if (!response.ok)
      throw new BadGatewayException("GitHub repository lookup failed");
    const data = (await response.json()) as any;
    if (
      data.private !== false ||
      !Number.isSafeInteger(data.id) ||
      data.id <= 0 ||
      typeof data.owner?.login !== "string" ||
      typeof data.name !== "string"
    )
      throw new BadRequestException(
        "Only public GitHub repositories are supported",
      );
    return {
      id: String(data.id),
      owner: data.owner.login,
      name: data.name,
      url: `https://github.com/${data.owner.login}/${data.name}`,
    };
  }
}
