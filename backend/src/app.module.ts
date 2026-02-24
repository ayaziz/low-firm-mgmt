import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { CustomerModule } from './customer/customer.module';
import { CaseModule } from './case/case.module';
import { DocumentModule } from './document/document.module';
import { AccountingModule } from './accounting/accounting.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { SearchModule } from './search/search.module';
import { NotificationModule } from './notification/notification.module';
import { ReportModule } from './report/report.module';
import { HealthModule } from './health/health.module';
import { WorkerModule } from './worker/worker.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { TenantGuard } from './auth/tenant.guard';
import { LoggingModule } from './common/logging.module';
import { LoggingInterceptor } from './common/logging.interceptor';
import { CorrelationMiddleware } from './common/correlation.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggingModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    PrismaModule,
    AuthModule,
    TenantModule,
    CustomerModule,
    CaseModule,
    DocumentModule,
    AccountingModule,
    AdminModule,
    AuditModule,
    SearchModule,
    NotificationModule,
    ReportModule,
    HealthModule,
    WorkerModule,
    TelemetryModule,
  ],
  providers: [
    // TenantGuard enforces ABAC tenant boundary on every authenticated request.
    // It only checks when user is present (after JwtAuthGuard), so public
    // endpoints (health, auth/dev/login) are unaffected.
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    // Global HTTP logging interceptor — logs every request/response with
    // correlation ID, user context, and timing.
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Correlation ID middleware runs first on all routes
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
