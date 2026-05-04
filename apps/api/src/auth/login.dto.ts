import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class LoginDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class CandidateRegisterDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(4)
  @MaxLength(60)
  @Matches(/^[a-zA-Z0-9_.-]+$/)
  username!: string;

  @Transform(({ value }) => trimString(value))
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(40)
  phone!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  currentCompany?: string;
}
