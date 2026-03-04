import { Controller, Post, Body, HttpCode, HttpStatus, UnauthorizedException, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';
import { LoginDto, RefreshTokenDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Production login ────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // ── Refresh token ───────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  // ── Logout (client-side token discard) ──────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout() {
    // Token invalidation is client-side for now.
    // Future: add token blacklist or version increment.
    return;
  }

  // ── Dev-only endpoints (disabled in production) ─────────────

  @Public()
  @Post('dev/login')
  @HttpCode(HttpStatus.OK)
  async devLogin(@Body() body: { email: string }) {
    try {
      return await this.authService.devLogin(body.email);
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @Post('dev/step-up')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async devStepUp(@Request() req: any) {
    try {
      return await this.authService.devStepUp(req.user.id);
    } catch {
      throw new UnauthorizedException('Step-up failed');
    }
  }
}
