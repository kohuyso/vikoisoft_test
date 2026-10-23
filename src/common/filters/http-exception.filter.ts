import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '../interfaces/api-response.interface.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const errorObj = res as Record<string, unknown>;
        if (
          typeof errorObj.message === 'string' ||
          Array.isArray(errorObj.message)
        ) {
          message = errorObj.message as string | string[];
        }
        if (typeof errorObj.error === 'string') {
          error = errorObj.error;
        }
      }
    } else if (exception instanceof URIError) {
      // Handles malformed URI percent-encoding (e.g. /api/orders/%E0%A4%A)
      status = HttpStatus.BAD_REQUEST;
      message = 'URI malformed';
      error = 'Bad Request';
    } else if (
      typeof exception === 'object' &&
      exception !== null &&
      ('status' in exception || 'statusCode' in exception)
    ) {
      // Handles Express/body-parser errors (e.g. malformed JSON SyntaxError 400, PayloadTooLarge 413)
      const err = exception as {
        status?: number;
        statusCode?: number;
        message?: string;
        name?: string;
      };
      status = err.status ?? err.statusCode ?? HttpStatus.BAD_REQUEST;
      message = err.message || 'Invalid request payload';
      error =
        err.name ||
        (status === HttpStatus.BAD_REQUEST
          ? 'Bad Request'
          : status === HttpStatus.PAYLOAD_TOO_LARGE
            ? 'Payload Too Large'
            : 'Client Error');
    } else {
      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.stack : String(exception)}`,
      );
    }

    const errorPayload: ApiErrorResponse = {
      success: false,
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorPayload);
  }
}
