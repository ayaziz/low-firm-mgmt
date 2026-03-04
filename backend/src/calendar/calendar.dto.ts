import { IsString, IsOptional, IsEnum, IsDateString, IsArray, IsNumber, IsBoolean, IsUUID } from 'class-validator';

export class CreateCalendarEventDto {
  @IsString()
  title: string;

  @IsDateString()
  startAt: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsEnum(['Hearing', 'Meeting', 'Deadline', 'Task', 'Reminder', 'Other'])
  eventType: string;

  @IsOptional() @IsUUID()
  caseId?: string;

  @IsOptional() @IsUUID()
  hearingId?: string;

  @IsOptional() @IsString()
  location?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsEnum(['None', 'Daily', 'Weekly', 'Monthly', 'Yearly'])
  recurrence?: string;

  @IsOptional() @IsDateString()
  recurrenceEndDate?: string;

  @IsOptional() @IsString()
  recurrenceRule?: string;

  @IsOptional() @IsBoolean()
  allDay?: boolean;

  @IsOptional() @IsArray() @IsUUID('4', { each: true })
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

  @IsOptional() @IsEnum(['Scheduled', 'Confirmed', 'Completed', 'Cancelled'])
  status?: string;

  @IsOptional() @IsEnum(['None', 'Daily', 'Weekly', 'Monthly', 'Yearly'])
  recurrence?: string;

  @IsOptional() @IsDateString()
  recurrenceEndDate?: string;

  @IsOptional() @IsString()
  recurrenceRule?: string;

  @IsOptional() @IsBoolean()
  allDay?: boolean;
}

export class AddAttendeeDto {
  @IsUUID()
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

  @IsOptional() @IsEnum(['InApp', 'Email', 'Both'])
  channel?: string;
}
