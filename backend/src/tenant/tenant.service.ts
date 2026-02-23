import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenantBySlug(slug: string) {
    return this.prisma.tenant.findUnique({ where: { slug } });
  }

  async getTenantById(id: string) {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  async provisionTenantSchema(slug: string) {
    const schemaName = `tenant_${slug.replace(/-/g, '_')}`;
    await this.prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    // In production, we'd apply the tenant-schema.sql here
    return schemaName;
  }
}
