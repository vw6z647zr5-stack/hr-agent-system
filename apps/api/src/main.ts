import 'reflect-metadata';
import './config/env';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import {
  getCorsOptions,
  getFileStorageRoot,
  getHost,
  getPort,
  rateLimitMiddleware,
  securityHeadersMiddleware,
} from './config/security';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const userPhotosRoot = resolve(process.cwd(), getFileStorageRoot(), 'user-photos');

  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.setGlobalPrefix('api');
  app.use(securityHeadersMiddleware);
  app.use(rateLimitMiddleware);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableCors(getCorsOptions());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
      stopAtFirstError: true,
      exceptionFactory: () => new BadRequestException('请求参数格式不正确，请检查必填项、邮箱、日期和数字格式。'),
    }),
  );
  app.useStaticAssets(userPhotosRoot, {
    prefix: '/uploads/user-photos/',
    dotfiles: 'deny',
    setHeaders: (response) => {
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Cache-Control', 'private, max-age=86400');
    },
  });

  await app.listen(getPort(), getHost());
}

void bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
