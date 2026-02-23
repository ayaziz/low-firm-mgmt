import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common/types';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async devLogin(email: string): Promise<{ accessToken: string; user: any }> {
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
      include: { tenant: true },
    });

    if (!user) {
      throw new Error('User not found or inactive');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      roles: user.roles,
      displayName: user.displayName,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        roles: user.roles,
        tenantId: user.tenantId,
        tenantSlug: user.tenant.slug,
        language: user.language,
      },
    };
  }

  async devStepUp(userId: string): Promise<{ stepUpToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      roles: user.roles,
      displayName: user.displayName,
      stepUp: true,
    };

    const stepUpToken = this.jwtService.sign(payload, { expiresIn: '5m' });

    return { stepUpToken };
  }

  async validateUser(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });
    if (!user || !user.isActive) return null;
    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      roles: user.roles,
      displayName: user.displayName,
      language: user.language,
      stepUp: payload.stepUp || false,
    };
  }
}
