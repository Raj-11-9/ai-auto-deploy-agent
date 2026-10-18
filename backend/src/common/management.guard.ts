import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "crypto";
@Injectable()
export class ManagementGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const provided = context.switchToHttp().getRequest().headers.authorization;
    const expected = process.env.MANAGEMENT_API_TOKEN;
    if (
      !expected ||
      typeof provided !== "string" ||
      !provided.startsWith("Bearer ") ||
      !timingSafeEqual(
        createHash("sha256").update(provided.slice(7)).digest(),
        createHash("sha256").update(expected).digest(),
      )
    ) {
      throw new UnauthorizedException("Management token required");
    }
    return true;
  }
}
