import { Controller, Post, Body, HttpCode, HttpStatus, UnauthorizedException, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth/dev')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async devLogin(@Body() body: { email: string }) {
    try {
      const result = await this.authService.devLogin(body.email);
      return result;
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @Post('step-up')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async devStepUp(@Request() req: any) {
    try {
      const result = await this.authService.devStepUp(req.user.id);
      return result;
    } catch {
      throw new UnauthorizedException('Step-up failed');
    }
  }
}
