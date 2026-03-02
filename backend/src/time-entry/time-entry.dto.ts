import { IsString, IsOptional, IsEnum, IsDateString, IsNumber, IsBoolean, Min } from 'class-validator';

export class CreateTimeEntryDto {
  @IsString()
  caseId: string;

  @IsDateString()
  entryDate: string;

  @IsNumber()
  @Min(0.01)
  hours: number;

  @IsString()
  description: string;

  @IsOptional() @IsString()
  activityType?: string;

  @IsOptional() @IsNumber()
  @Min(0)
  ratePerHour?: number;

  @IsOptional() @IsString()
  hearingId?: string;

  @IsOptional() @IsBoolean()
  billable?: boolean;
}

export class UpdateTimeEntryDto {
  @IsOptional() @IsDateString()
  entryDate?: string;

  @IsOptional() @IsNumber()
  @Min(0.01)
  hours?: number;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  activityType?: string;

  @IsOptional() @IsNumber()
  @Min(0)
  ratePerHour?: number;

  @IsOptional() @IsBoolean()
  billable?: boolean;
}

export class TransitionTimeEntryDto {
  @IsEnum(['Submitted', 'Approved', 'Billed', 'WriteOff'])
  toStatus: string;

  @IsOptional() @IsString()
  reason?: string;
}
