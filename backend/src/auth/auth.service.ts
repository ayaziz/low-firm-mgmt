import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common/types';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── Production login (password-verified) ────────────────────

  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
      include: { tenant: true },
    });

    if (!user) {
      this.logger.warn(`Login failed – user not found: ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    // If passwordHash is empty or the legacy 'dev' placeholder, reject in production
    if (!user.passwordHash || user.passwordHash === 'dev' || user.passwordHash === '') {
      const isDevMode = this.config.get<string>('NODE_ENV', 'development') !== 'production';
      if (!isDevMode) {
        throw new UnauthorizedException('Password not set – contact administrator');
      }
      // In dev mode, allow any password for unset hashes (fallback to devLogin behaviour)
    } else {
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        this.logger.warn(`Login failed – wrong password: ${email}`);
        throw new UnauthorizedException('Invalid email or password');
      }
    }

    const payload = this.buildPayload(user);
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      { sub: user.id, tokenType: 'refresh' },
      { expiresIn: '7d' },
    );

    this.logger.log(`User logged in: ${email}`);
    return { accessToken, refreshToken, user: this.sanitiseUser(user) };
  }

  // ── Refresh token rotation ──────────────────────────────────

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    let decoded: any;
    try {
      decoded = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (decoded.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const payload = this.buildPayload(user);
    const newAccessToken = this.jwtService.sign(payload);
    const newRefreshToken = this.jwtService.sign(
      { sub: user.id, tokenType: 'refresh' },
      { expiresIn: '7d' },
    );

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  // ── Dev login (email only, no password) ─────────────────────

  async devLogin(email: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    const isDevMode = this.config.get<string>('NODE_ENV', 'development') !== 'production';
    if (!isDevMode) {
      throw new UnauthorizedException('Dev login is disabled in production');
    }

    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const payload = this.buildPayload(user);
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      { sub: user.id, tokenType: 'refresh' },
      { expiresIn: '7d' },
    );

    this.logger.log(`Dev login: ${email}`);
    return { accessToken, refreshToken, user: this.sanitiseUser(user) };
  }

  // ── Step-up authentication ──────────────────────────────────

  async devStepUp(userId: string): Promise<{ stepUpToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const payload: JwtPayload = {
      ...this.buildPayload(user),
      stepUp: true,
    };

    const stepUpToken = this.jwtService.sign(payload, { expiresIn: '5m' });
    return { stepUpToken };
  }

  // ── Password management ─────────────────────────────────────

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  // ── JWT validation (called by JwtStrategy on every request) ─

  async validateUser(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });
    if (!user || !user.isActive) return null;
    return {
      sub: user.id,
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

  // ── Private helpers ─────────────────────────────────────────

  private buildPayload(user: any): JwtPayload {
    return {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      roles: user.roles,
      displayName: user.displayName,
    };
  }

  private sanitiseUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      language: user.language,
    };
  }
}
