import { IsString, IsOptional, IsEnum, IsArray, IsBoolean, IsDateString } from 'class-validator';

export class CreateCaseDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  caseTypeId: string;

  @IsArray()
  @IsString({ each: true })
  customerIds: string[];

  @IsOptional()
  @IsString()
  assignedLawyerUserId?: string;

  @IsOptional()
  @IsString()
  courtCaseNumber?: string;
}

export class TransitionCaseDto {
  @IsEnum(['Intake', 'Open', 'Active', 'Pending', 'Closed', 'Archived'])
  toState: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class SetOnHoldDto {
  @IsString()
  reason: string;
}

export class ReopenCaseDto {
  @IsString()
  reason: string;
}

export class CreateMembershipDto {
  @IsString()
  userId: string;

  @IsEnum(['CaseOwner', 'CaseMember', 'ReadOnly'])
  role: string;
}

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  assigneeUserId: string;

  @IsOptional()
  @IsString()
  reviewerUserId?: string;

  @IsOptional()
  @IsEnum(['Low', 'Medium', 'High'])
  priority?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @IsOptional()
  @IsString()
  reviewerUserId?: string;

  @IsOptional()
  @IsEnum(['Low', 'Medium', 'High'])
  priority?: string;

  @IsOptional()
  @IsEnum(['Open', 'InProgress', 'Blocked', 'Done', 'Cancelled'])
  status?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class CreateSessionDto {
  @IsString()
  title: string;

  @IsString()
  typeId: string;

  @IsDateString()
  startDateTime: string;

  @IsDateString()
  endDateTime: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  courtId?: string;
}

export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(['Planned', 'Completed', 'Postponed', 'Cancelled'])
  status?: string;

  @IsOptional()
  @IsString()
  outcomeNotes?: string;

  @IsOptional()
  @IsString()
  location?: string;
}

export class RescheduleSessionDto {
  @IsDateString()
  newDateTime: string;

  @IsString()
  reason: string;
}

export class CreateNoteDto {
  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsEnum(['LegalOnly', 'FinanceAllowed'])
  visibilityScope?: string;

  @IsOptional()
  @IsString()
  referencedNoteId?: string;
}

export class CreateFilingDto {
  @IsString()
  typeId: string;

  @IsOptional()
  @IsEnum(['Draft', 'Filed', 'Accepted', 'Rejected', 'Withdrawn'])
  status?: string;

  @IsOptional()
  @IsDateString()
  filedDate?: string;

  @IsOptional()
  @IsString()
  courtCaseNumber?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFilingDto {
  @IsOptional()
  @IsEnum(['Draft', 'Filed', 'Accepted', 'Rejected', 'Withdrawn'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;
}

export class CreateCommunicationDto {
  @IsString()
  typeId: string;

  @IsDateString()
  dateTime: string;

  @IsEnum(['Inbound', 'Outbound'])
  direction: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  nextSteps?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsEnum(['LegalOnly', 'FinanceAllowed'])
  visibilityScope?: string;

  @IsOptional()
  @IsString()
  participants?: string;
}

export class AddCasePartyDto {
  @IsString()
  partyId: string;

  @IsEnum(['Customer', 'Opposing', 'ExternalCounsel', 'Other'])
  partyRoleType: string;

  @IsOptional()
  @IsString()
  participantRoleId?: string;

  @IsOptional()
  @IsEnum(['LegalOnly', 'FinanceAllowed'])
  visibilityScope?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
