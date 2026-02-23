import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
})
export class AppModule {}
