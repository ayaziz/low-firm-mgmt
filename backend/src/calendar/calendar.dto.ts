import { IsString, IsOptional, IsEnum, IsDateString, IsArray, IsNumber, IsBoolean } from 'class-validator';

export class CreateCalendarEventDto {
  @IsString()
  title: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsEnum(['Hearing', 'Meeting', 'Deadline', 'Task', 'Reminder', 'Other'])
  eventType: string;

  @IsOptional() @IsString()
  caseId?: string;

  @IsOptional() @IsString()
  hearingId?: string;

  @IsOptional() @IsString()
  location?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsEnum(['None', 'Daily', 'Weekly', 'Monthly', 'Yearly'])
  recurrence?: string;

  @IsOptional() @IsDateString()
  recurrenceEndDate?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  attendeeUserIds?: string[];

  @IsOptional() @IsArray()
  reminders?: { minutesBefore: number; channel: string }[];
}

export class UpdateCalendarEventDto {
  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsDateString()
  startAt?: string;

  @IsOptional() @IsDateString()
  endAt?: string;

  @IsOptional() @IsEnum(['Hearing', 'Meeting', 'Deadline', 'Task', 'Reminder', 'Other'])
  eventType?: string;

  @IsOptional() @IsString()
  location?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsEnum(['Active', 'Completed', 'Cancelled'])
  status?: string;

  @IsOptional() @IsEnum(['None', 'Daily', 'Weekly', 'Monthly', 'Yearly'])
  recurrence?: string;

  @IsOptional() @IsDateString()
  recurrenceEndDate?: string;
}

export class AddAttendeeDto {
  @IsString()
  userId: string;

  @IsOptional() @IsEnum(['Pending', 'Accepted', 'Declined', 'Tentative'])
  rsvp?: string;
}

export class UpdateRsvpDto {
  @IsEnum(['Accepted', 'Declined', 'Tentative'])
  rsvp: string;
}

export class AddReminderDto {
  @IsNumber()
  minutesBefore: number;

  @IsOptional() @IsEnum(['InApp', 'Email', 'SMS'])
  channel?: string;
}
