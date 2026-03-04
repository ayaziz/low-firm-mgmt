import { IsString, IsOptional, IsEnum, IsBoolean, IsEmail, IsUUID } from 'class-validator';

// ── Court DTOs ──────────────────────────────────────────────────

export class CreateCourtDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  circuit?: string;

  @IsOptional()
  @IsEnum(['District', 'Appeal', 'Supreme', 'Specialized'])
  jurisdictionLevel?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  addressText?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCourtDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  circuit?: string;

  @IsOptional()
  @IsEnum(['District', 'Appeal', 'Supreme', 'Specialized'])
  jurisdictionLevel?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  addressText?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── Judge DTOs ──────────────────────────────────────────────────

export class CreateJudgeDto {
  @IsUUID()
  courtId: string;

  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateJudgeDto {
  @IsOptional()
  @IsUUID()
  courtId?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
