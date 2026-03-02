import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';

export class CreateHearingDto {
  @IsString()
  caseId: string;

  @IsOptional()
  @IsString()
  courtId?: string;

  @IsOptional()
  @IsString()
  judgeId?: string;

  @IsDateString()
  hearingDate: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(['Initial', 'Continuation', 'Ruling', 'Appeal', 'Procedural'])
  hearingType?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateHearingDto {
  @IsOptional()
  @IsString()
  courtId?: string;

  @IsOptional()
  @IsString()
  judgeId?: string;

  @IsOptional()
  @IsDateString()
  hearingDate?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(['Initial', 'Continuation', 'Ruling', 'Appeal', 'Procedural'])
  hearingType?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class TransitionHearingDto {
  @IsEnum(['Scheduled', 'Completed', 'Postponed', 'Cancelled'])
  toStatus: string;

  @IsOptional()
  @IsString()
  outcome?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsDateString()
  newDate?: string; // Used when postponing
}
