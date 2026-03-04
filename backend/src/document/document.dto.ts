import { IsString, IsOptional, IsEnum, IsUUID, IsDateString, IsArray } from 'class-validator';

export class CreateDocumentDto {
  @IsString() title: string;
  @IsUUID() docTypeId: string;
  @IsString() fileName: string;
  @IsString() mimeType: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsUUID() caseId?: string;
  @IsOptional() @IsEnum(['Normal', 'Confidential', 'HighlyConfidential'])
  confidentialityLevel?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsUUID() folderId?: string;
}

export class CheckinDocumentDto {
  @IsString() fileName: string;
  @IsString() mimeType: string;
}

export class ShareDocumentDto {
  @IsUUID() userId: string;
  @IsOptional() @IsEnum(['View', 'Download', 'UploadNewVersion', 'Share', 'Admin']) permission?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}
