import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let mockJwtService: any;
  let mockPrisma: any;
  let mockConfig: any;

  beforeEach(() => {
    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn(),
    };
    mockPrisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    mockConfig = {
      get: jest.fn().mockReturnValue('development'),
    };
    service = new AuthService(mockJwtService, mockPrisma, mockConfig);
  });

  // ── login ───────────────────────────────────────────────────

  describe('login', () => {
    const mockUser = {
      id: 'u1',
      email: 'test@demo.com',
      displayName: 'Test User',
      passwordHash: '',
      roles: ['Lawyer'],
      tenantId: 't1',
      isActive: true,
      language: 'en',
      tenant: { slug: 'demo-firm' },
    };

    it('should throw when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(service.login('x@x.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('should accept any password in dev mode when hash is placeholder', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, passwordHash: 'dev' });
      mockConfig.get.mockReturnValue('development');

      const result = await service.login('test@demo.com', 'anything');
      expect(result.accessToken).toBe('mock-token');
      expect(result.user.email).toBe('test@demo.com');
    });

    it('should reject placeholder hash in production', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, passwordHash: 'dev' });
      mockConfig.get.mockReturnValue('production');

      await expect(service.login('test@demo.com', 'anything')).rejects.toThrow(UnauthorizedException);
    });

    it('should verify bcrypt hash and return tokens', async () => {
      const hash = await bcrypt.hash('Password1!', 10);
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, passwordHash: hash });

      const result = await service.login('test@demo.com', 'Password1!');
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('should reject wrong password', async () => {
      const hash = await bcrypt.hash('Password1!', 10);
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, passwordHash: hash });

      await expect(service.login('test@demo.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── devLogin ────────────────────────────────────────────────

  describe('devLogin', () => {
    it('should reject in production mode', async () => {
      mockConfig.get.mockReturnValue('production');
      await expect(service.devLogin('test@demo.com')).rejects.toThrow(UnauthorizedException);
    });

    it('should allow in development mode', async () => {
      mockConfig.get.mockReturnValue('development');
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1', email: 'test@demo.com', displayName: 'Test', roles: ['Lawyer'],
        tenantId: 't1', isActive: true, language: 'en', tenant: { slug: 'demo-firm' },
      });

      const result = await service.devLogin('test@demo.com');
      expect(result.accessToken).toBe('mock-token');
    });
  });

  // ── refreshTokens ──────────────────────────────────────────

  describe('refreshTokens', () => {
    it('should reject invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error('invalid'); });
      await expect(service.refreshTokens('bad')).rejects.toThrow(UnauthorizedException);
    });

    it('should reject non-refresh token type', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'u1', tokenType: 'access' });
      await expect(service.refreshTokens('tok')).rejects.toThrow(UnauthorizedException);
    });

    it('should issue new token pair for valid refresh', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'u1', tokenType: 'refresh' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'test@demo.com', displayName: 'Test', roles: ['Lawyer'],
        tenantId: 't1', isActive: true, language: 'en', tenant: { slug: 'demo-firm' },
      });

      const result = await service.refreshTokens('valid-refresh');
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
    });
  });

  // ── validateUser ───────────────────────────────────────────

  describe('validateUser', () => {
    it('should return null for missing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await service.validateUser({ sub: 'x', email: '', tenantId: '', tenantSlug: '', roles: [], displayName: '' });
      expect(result).toBeNull();
    });

    it('should return user context for active user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'test@demo.com', displayName: 'Test', roles: ['Lawyer'],
        tenantId: 't1', isActive: true, language: 'en', tenant: { slug: 'demo-firm' },
      });

      const result = await service.validateUser({
        sub: 'u1', email: 'test@demo.com', tenantId: 't1', tenantSlug: 'demo-firm', roles: ['Lawyer'], displayName: 'Test',
      });
      expect(result).not.toBeNull();
      expect(result!.id).toBe('u1');
    });
  });

  // ── hashPassword ───────────────────────────────────────────

  describe('hashPassword', () => {
    it('should produce a bcrypt hash', async () => {
      const hash = await service.hashPassword('test123');
      expect(hash).toMatch(/^\$2[aby]\$/);
      expect(await bcrypt.compare('test123', hash)).toBe(true);
    });
  });
});
