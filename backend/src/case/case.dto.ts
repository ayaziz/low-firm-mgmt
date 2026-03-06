import { IsString, IsOptional, IsEnum, IsArray, IsBoolean, IsDateString, IsUUID, IsNumber } from 'class-validator';

export class CreateCaseDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  caseTypeId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  customerIds: string[];

  @IsOptional()
  @IsUUID()
  assignedLawyerUserId?: string;

  @IsOptional()
  @IsString()
  courtCaseNumber?: string;

  @IsOptional()
  @IsUUID()
  primaryCourtId?: string;

  @IsOptional()
  @IsUUID()
  primaryJudgeId?: string;
}

export class AddCaseCustomerDto {
  @IsUUID()
  customerId: string;

  @IsOptional()
  @IsEnum(['Client', 'Defendant', 'Witness', 'ThirdParty', 'Other'])
  role?: string;
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
  @IsUUID()
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

  @IsUUID()
  assigneeUserId: string;

  @IsOptional()
  @IsUUID()
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
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  linkedDocumentIds?: string[];

  @IsOptional()
  @IsNumber()
  estimatedHours?: number;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string;

  @IsOptional()
  @IsUUID()
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

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  linkedDocumentIds?: string[];

  @IsOptional()
  @IsNumber()
  estimatedHours?: number;
}

export class CreateSessionDto {
	@IsString()
	title: string

	@IsUUID()
	typeId: string

	@IsDateString()
	startDateTime: string

	@IsOptional()
	@IsDateString()
	endDateTime?: string

	@IsOptional()
	@IsString()
	location?: string

	@IsOptional()
	@IsUUID()
	courtId?: string

	@IsOptional()
	@IsArray()
	@IsUUID('4', { each: true })
	linkedDocumentIds?: string[]

	@IsOptional()
	@IsBoolean()
	isBillable: boolean
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

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  linkedDocumentIds?: string[];
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
  @IsUUID()
  referencedNoteId?: string;
}

export class CreateFilingDto {
  @IsUUID()
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
  @IsUUID()
  typeId: string;

  @IsDateString()
  dateTime: string;

  @IsEnum(['Inbound', 'Outbound'])
  direction: string;

  @IsString()
  summary: string;

  @IsOptional()
  @IsString()
  nextSteps?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsEnum(['LegalOnly', 'FinanceAllowed'])
  visibilityScope?: string;

  @IsOptional()
  @IsString()
  participants?: string;
}

export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class UpdateCommunicationDto {
  @IsOptional()
  @IsUUID()
  typeId?: string;

  @IsOptional()
  @IsDateString()
  dateTime?: string;

  @IsOptional()
  @IsEnum(['Inbound', 'Outbound'])
  direction?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  nextSteps?: string;

  @IsOptional()
  @IsString()
  participants?: string;
}

export class AddCasePartyDto {
  @IsUUID()
  partyId: string;

  @IsEnum(['Customer', 'Opposing', 'ExternalCounsel', 'Other'])
  partyRoleType: string;

  @IsOptional()
  @IsUUID()
  participantRoleId?: string;

  @IsOptional()
  @IsEnum(['LegalOnly', 'FinanceAllowed'])
  visibilityScope?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCasePartyDto {
  @IsOptional()
  @IsEnum(['Customer', 'Opposing', 'ExternalCounsel', 'Other'])
  partyRoleType?: string;

  @IsOptional()
  @IsUUID()
  participantRoleId?: string;

  @IsOptional()
  @IsEnum(['LegalOnly', 'FinanceAllowed'])
  visibilityScope?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
