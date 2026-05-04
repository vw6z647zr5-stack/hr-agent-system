import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class LoginDto {
  @ApiProperty({ description: '用户名', example: 'admin' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  username!: string;

  @ApiProperty({ description: '密码', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class CandidateRegisterDto {
  @ApiProperty({ description: '用户名', minLength: 4, maxLength: 60, example: 'zhangsan' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(4)
  @MaxLength(60)
  @Matches(/^[a-zA-Z0-9_.-]+$/)
  username!: string;

  @ApiProperty({ description: '邮箱', example: 'zhangsan@example.com' })
  @Transform(({ value }) => trimString(value))
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({ description: '姓名', example: '张三' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ description: '密码', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ description: '手机号', example: '13800138000' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(40)
  phone!: string;

  @ApiPropertyOptional({ description: '当前公司' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  currentCompany?: string;
}
