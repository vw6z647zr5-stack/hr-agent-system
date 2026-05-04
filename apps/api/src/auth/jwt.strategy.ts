import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtSecret } from '../config/security';
import { AuthSessionService } from './auth-session.service';
import { UsersService } from '../users/users.service';
import { AuthenticatedUser } from '../users/user.entity';

interface JwtPayload {
  sub: string;
  jti?: string;
  companyId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    private readonly authSessionService: AuthSessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    await this.authSessionService.assertSession(payload.sub, payload.jti);
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('当前用户未启用。');
    }

    return {
      ...(await this.usersService.buildAuthenticatedUser(user)),
      sessionId: payload.jti,
      companyId: user.companyId,
    };
  }
}
