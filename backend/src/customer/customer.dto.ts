import { IsString, IsOptional, IsEnum, IsArray, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContactDto {
	@IsString()
	name: string

	@IsOptional()
	@IsString()
	email?: string

	@IsOptional()
	@IsString()
	phone?: string

	@IsOptional()
	@IsString()
	role_id?: string

	@IsOptional()
	isPrimary?: boolean
}

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  lines?: string;

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
	customer_type: 'Individual' | 'Organization'

	@IsOptional()
	@IsEnum(['Active', 'Inactive', 'Prospect'])
	status?: string

	@IsOptional()
	@IsString()
	notes?: string

	@IsOptional()
	@IsString()
	national_id?: string

	@IsOptional()
	@IsString()
	passport_number?: string

	@IsOptional()
	@IsString()
	registration_id?: string

	@IsOptional()
	@IsString()
	tax_id?: string

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

  @IsString()
  rowVersion: string;
}

export class CreateCustomerCommunicationDto {
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
  @IsEnum(['LegalOnly', 'FinanceAllowed'])
  visibilityScope?: string;

  @IsOptional()
  @IsString()
  participants?: string;
}
