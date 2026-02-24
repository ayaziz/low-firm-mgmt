import { IsString, IsOptional, IsEnum, IsUUID, IsDateString } from 'class-validator';

export class CreateDocumentDto {
  @IsString() title: string;
  @IsString() docTypeId: string;
  @IsString() fileName: string;
  @IsString() mimeType: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() caseId?: string;
  @IsOptional() @IsEnum(['Standard', 'Confidential', 'HighlyConfidential'])
  confidentialityLevel?: string;
}

export class CheckinDocumentDto {
  @IsString() fileName: string;
  @IsString() mimeType: string;
  @IsOptional() @IsString() changeNote?: string;
}

export class ShareDocumentDto {
  @IsString() userId: string;
  @IsOptional() @IsEnum(['Read', 'ReadWrite']) permission?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}
