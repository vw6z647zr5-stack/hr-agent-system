import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DepartmentEntity,
  EmployeeContractEntity,
  EmployeeEntity,
  PositionEntity,
} from './organization.entities';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

@Module({
  imports: [TypeOrmModule.forFeature([DepartmentEntity, PositionEntity, EmployeeEntity, EmployeeContractEntity])],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
