import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { AuthSessionService } from '../auth/auth-session.service';
import { CompanyEntity } from './company.entity';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanyEntity, UserEntity]),
    JwtModule,
    UsersModule,
  ],
  controllers: [CompanyController],
  providers: [CompanyService, AuthSessionService],
  exports: [CompanyService],
})
export class CompanyModule {}
