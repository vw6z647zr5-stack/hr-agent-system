import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class RegisterCompanyDto {
  @ApiProperty({ description: '企业名称', example: '测试科技有限公司' })
  @IsNotEmpty()
  @MaxLength(120)
  companyName!: string;

  @ApiProperty({ description: '行业', enum: ['it', 'finance', 'manufacturing', 'retail', 'education', 'healthcare', 'other'], example: 'it' })
  @IsNotEmpty()
  @IsIn(['it', 'finance', 'manufacturing', 'retail', 'education', 'healthcare', 'other'])
  industry!: string;

  @ApiProperty({ description: '企业规模', enum: ['1-50', '51-200', '201-1000', '1000+'], example: '1-50' })
  @IsNotEmpty()
  @IsIn(['1-50', '51-200', '201-1000', '1000+'])
  size!: string;

  @ApiProperty({ description: '联系人姓名', example: '张三' })
  @MaxLength(120)
  contactName!: string;

  @ApiProperty({ description: '联系人邮箱', example: 'zhangsan@example.com' })
  @IsEmail()
  contactEmail!: string;

  @ApiProperty({ description: '联系人电话', example: '13800138000' })
  @MaxLength(40)
  contactPhone!: string;

  @ApiProperty({ description: '管理员用户名', minLength: 3, maxLength: 60, example: 'admin' })
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(60)
  adminUsername!: string;

  @ApiProperty({ description: '管理员邮箱', example: 'admin@example.com' })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ description: '管理员密码', minLength: 8, maxLength: 64 })
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(64)
  adminPassword!: string;

  @ApiProperty({ description: '管理员姓名', example: '系统管理员' })
  @IsNotEmpty()
  @MaxLength(120)
  adminDisplayName!: string;
}
