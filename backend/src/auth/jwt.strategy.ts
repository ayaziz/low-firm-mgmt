import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';
import { JwtPayload } from '../common/types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'loma-dev-secret-key-change-in-production'),
    });
  }

  async validate(payload: JwtPayload) {
    // Reject refresh tokens used as access tokens
    if ((payload as any).tokenType === 'refresh') return null;
    const user = await this.authService.validateUser(payload);
    if (!user) {
      return null;
    }
    return user;
  }
}
