import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly tenantPool: Pool;

  constructor() {
    super();
    this.tenantPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.tenantPool.end();
    await this.$disconnect();
  }

  async executeInTenantSchema<T>(tenantSlug: string, callback: (schemaName: string) => Promise<T>): Promise<T> {
    const schemaName = `tenant_${tenantSlug.replace(/-/g, '_')}`;
    return callback(schemaName);
  }

  async queryTenant(tenantSlug: string, sql: string, params: any[] = []): Promise<any> {
    const schemaName = `tenant_${tenantSlug.replace(/-/g, '_')}`;
    const client = await this.tenantPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL search_path TO "${schemaName}", public`);
      const result = await client.query(sql, params);
      await client.query('COMMIT');
      return result.rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async executeTenant(tenantSlug: string, sql: string, params: any[] = []): Promise<void> {
    const schemaName = `tenant_${tenantSlug.replace(/-/g, '_')}`;
    const client = await this.tenantPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL search_path TO "${schemaName}", public`);
      await client.query(sql, params);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
