import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { AgentModule } from './agents/agent.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditActionInterceptor } from './common/interceptors/audit-action.interceptor';
import { DATABASE_ENTITIES } from './database/entities';
import { OrganizationModule } from './organization/organization.module';
import { PayrollModule } from './payroll/payroll.module';
import { PerformanceModule } from './performance/performance.module';
import { RedisModule } from './redis/redis.module';
import { RecruitmentModule } from './recruitment/recruitment.module';
import { SelfServiceModule } from './self-service/self-service.module';
import { StorageModule } from './storage/storage.module';
import { OverviewModule } from './overview/overview.module';
import { UsersModule } from './users/users.module';
import { CompanyModule } from './company/company.module';
import { AuditModule } from './audit/audit.module';
import { TenantModule } from './tenant/tenant.module';
import { TenantInterceptor } from './tenant/tenant.interceptor';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { FeatureGuard } from './tenant/feature-guard';
import { ENV_FILE_PATHS } from './config/env';
import { getDatabaseUrl } from './config/security';
import { WorkflowModule } from './workflows/workflow.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATHS,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: getDatabaseUrl(),
      entities: [...DATABASE_ENTITIES],
      synchronize: false,
      autoLoadEntities: false,
      logging: false,
      namingStrategy: new SnakeNamingStrategy(),
    }),
    HealthModule,
    AuditModule,
    TenantModule,
    CompanyModule,
    WorkflowModule,
    RedisModule,
    StorageModule,
    UsersModule,
    AuthModule,
    OrganizationModule,
    RecruitmentModule,
    AttendanceModule,
    PerformanceModule,
    PayrollModule,
    SelfServiceModule,
    OverviewModule,
    AgentModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: FeatureGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditActionInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
