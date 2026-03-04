import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { AuditInterceptor } from './common/audit.interceptor';
import { CorrelationMiddleware } from './common/correlation.middleware';
// ── Phase 2 modules ──
import { CourtModule } from './court/court.module';
import { HearingModule } from './hearing/hearing.module';
import { CalendarModule } from './calendar/calendar.module';
import { FolderModule } from './folder/folder.module';
import { TimeEntryModule } from './time-entry/time-entry.module';
import { TemplateModule } from './template/template.module';

const isTestRuntime = !!process.env.JEST_WORKER_ID;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggingModule,
    ThrottlerModule.forRoot([{
      name: 'short',
      ttl: 1000,   // 1 second window
      limit: 20,   // 20 requests per second
    }, {
      name: 'medium',
      ttl: 60000,  // 1 minute window
      limit: 200,  // 200 requests per minute
    }, {
      name: 'long',
      ttl: 3600000, // 1 hour window
      limit: 5000,  // 5000 requests per hour
    }]),
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
    ...(isTestRuntime ? [] : [WorkerModule]),
    TelemetryModule,
    // ── Phase 2 modules ──
    CourtModule,
    HearingModule,
    CalendarModule,
    FolderModule,
    TimeEntryModule,
    TemplateModule,
  ],
  providers: [
    // TenantGuard enforces ABAC tenant boundary on every authenticated request.
    // It only checks when user is present (after JwtAuthGuard), so public
    // endpoints (health, auth/dev/login) are unaffected.
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    // Global rate limiter — protects all endpoints
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global HTTP logging interceptor — logs every request/response with
    // correlation ID, user context, and timing.
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Global audit interceptor — logs mutations annotated with @AuditAction()
    // to audit_events table (fire-and-forget, never blocks response).
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Correlation ID middleware runs first on all routes
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
