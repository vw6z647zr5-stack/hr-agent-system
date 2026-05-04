import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { MulterError } from 'multer';
import { QueryFailedError } from 'typeorm';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const normalized = this.normalizeException(exception);
    const status = normalized.getStatus();
    const payload = normalized.getResponse();

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(typeof payload === 'string' ? { message: payload } : payload),
    });
  }

  private normalizeException(exception: unknown): HttpException {
    if (exception instanceof HttpException) {
      return exception;
    }

    if (exception instanceof MulterError) {
      return this.normalizeMulterError(exception);
    }

    if (exception instanceof QueryFailedError) {
      return this.normalizeQueryFailedError(exception);
    }

    return new InternalServerErrorException('服务器内部错误，请稍后再试。');
  }

  private normalizeMulterError(error: MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new BadRequestException('上传文件大小超过限制。');
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return new BadRequestException('上传文件数量超过限制。');
    }

    return new BadRequestException('上传文件不合法。');
  }

  private normalizeQueryFailedError(error: QueryFailedError) {
    const driverError = error.driverError as { code?: string } | undefined;

    if (driverError?.code === '23505') {
      return new ConflictException('记录已存在，请检查编号、邮箱或名称是否重复。');
    }

    if (driverError?.code === '23503') {
      return new ConflictException('当前记录仍被其他数据引用，无法完成操作。');
    }

    if (driverError?.code === '23502') {
      return new BadRequestException('请求缺少必要字段。');
    }

    return new InternalServerErrorException('数据库操作失败，请稍后再试。');
  }
}
