import { IsString, IsOptional, IsEnum, IsArray, IsDateString, ValidateNested, IsUUID, IsEmail, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContactDto {
	@IsString()
	name: string

	@IsOptional()
	@IsEmail()
	email?: string

	@IsOptional()
	@IsString()
	phone?: string

	@IsOptional()
	@IsString()
	role_id?: string

	@IsOptional()
	@IsBoolean()
	isPrimary?: boolean
}

export class CreateAddressDto {
  @IsOptional()
  @IsEnum(['Home', 'Work', 'Mailing', 'Other'])
  type?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  line1?: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class CreateCustomerDto {
	@IsString()
	name: string

	@IsEnum(['Individual', 'Organization'])
	customerType: 'Individual' | 'Organization'

	@IsOptional()
	@IsEnum(['Active', 'Inactive', 'Prospect'])
	status?: string

	@IsOptional()
	@IsString()
	notes?: string

	@IsOptional()
	@IsString()
	nationalId?: string

	@IsOptional()
	@IsString()
	passportNumber?: string

	@IsOptional()
	@IsString()
	registrationId?: string

	@IsOptional()
	@IsString()
	taxId?: string

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateContactDto)
	contacts?: CreateContactDto[]

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateAddressDto)
	addresses?: CreateAddressDto[]
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['Active', 'Inactive', 'Prospect'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsString()
  passportNumber?: string;

  @IsOptional()
  @IsString()
  registrationId?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  rowVersion?: string;
}

export class CreateCustomerCommunicationDto {
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
  @IsEnum(['LegalOnly', 'FinanceAllowed'])
  visibilityScope?: string;

  @IsOptional()
  @IsString()
  participants?: string;
}
