import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeEntity } from '../organization/organization.entities';
import { UserEntity } from './user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, EmployeeEntity])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
