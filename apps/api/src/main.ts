import 'reflect-metadata';
import './config/env';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { requestContextMiddleware } from './common/request-context';
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
  app.use(requestContextMiddleware);
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('智能人事系统 API')
    .setDescription('企业人力资源智能管理系统 API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', '认证与授权')
    .addTag('companies', '企业管理')
    .addTag('organization', '组织架构')
    .addTag('recruitment', '招聘协同')
    .addTag('attendance', '考勤假期')
    .addTag('performance', '绩效评估')
    .addTag('payroll', '薪酬管理')
    .addTag('self-service', '员工自助')
    .addTag('agent', 'AI 智能体')
    .addTag('overview', '数据看板')
    .build();
  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDoc);

  await app.listen(getPort(), getHost());
}

void bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
