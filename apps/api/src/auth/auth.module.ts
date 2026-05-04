import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeEntity } from '../organization/organization.entities';
import { CandidateEntity } from '../recruitment/recruitment.entities';
import { getJwtExpiresIn, getJwtSecret } from '../config/security';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthSessionService } from './auth-session.service';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    TypeOrmModule.forFeature([EmployeeEntity, CandidateEntity]),
    JwtModule.register({
      global: true,
      secret: getJwtSecret(),
      signOptions: { expiresIn: getJwtExpiresIn() },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthSessionService, JwtStrategy],
  exports: [AuthService, AuthSessionService],
})
export class AuthModule {}
