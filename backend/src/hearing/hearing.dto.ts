import { IsString, IsOptional, IsEnum, IsDateString, IsUUID } from 'class-validator';

export class CreateHearingDto {
  @IsUUID()
  caseId: string;

  @IsOptional()
  @IsUUID()
  courtId?: string;

  @IsOptional()
  @IsUUID()
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
  @IsUUID()
  courtId?: string;

  @IsOptional()
  @IsUUID()
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
  @IsEnum(['Scheduled', 'Confirmed', 'InProgress', 'Adjourned', 'Completed', 'Postponed', 'Cancelled'])
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
