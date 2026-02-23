import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async executeInTenantSchema<T>(tenantSlug: string, callback: (schemaName: string) => Promise<T>): Promise<T> {
    const schemaName = `tenant_${tenantSlug.replace(/-/g, '_')}`;
    return callback(schemaName);
  }

  async queryTenant(tenantSlug: string, sql: string, params: any[] = []): Promise<any> {
    const schemaName = `tenant_${tenantSlug.replace(/-/g, '_')}`;
    const fullSql = `SET search_path TO "${schemaName}"; ${sql}`;
    if (params.length === 0) {
      return this.$queryRawUnsafe(fullSql);
    }
    return this.$queryRawUnsafe(fullSql, ...params);
  }

  async executeTenant(tenantSlug: string, sql: string, params: any[] = []): Promise<void> {
    const schemaName = `tenant_${tenantSlug.replace(/-/g, '_')}`;
    const fullSql = `SET search_path TO "${schemaName}"; ${sql}`;
    if (params.length === 0) {
      await this.$executeRawUnsafe(fullSql);
    } else {
      await this.$executeRawUnsafe(fullSql, ...params);
    }
  }
}
