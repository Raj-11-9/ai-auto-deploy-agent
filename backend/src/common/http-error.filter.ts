import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const parserStatus = (error as { type?: string; status?: number })?.type;
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : parserStatus === "entity.too.large"
          ? 413
          : parserStatus === "entity.parse.failed"
            ? 400
            : parserStatus === "encoding.unsupported"
              ? 415
              : 500;
    if (status >= 500)
      new Logger("HTTP").error(
        "Request failed; sensitive request data omitted",
      );
    http
      .getResponse()
      .status(status)
      .json({
        statusCode: status,
        error:
          status === 500
            ? "Internal server error"
            : error instanceof HttpException
              ? error.getResponse()
              : "Request failed",
        path: http.getRequest().url,
        timestamp: new Date().toISOString(),
      });
  }
}
