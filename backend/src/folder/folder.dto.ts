import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  name: string;

  @IsOptional() @IsUUID()
  caseId?: string;

  @IsOptional() @IsUUID()
  parentId?: string;

  @IsOptional() @IsEnum(['Customer', 'Case', 'Tenant'])
  scope?: string;
}

export class UpdateFolderDto {
  @IsOptional() @IsString()
  name?: string;
}

export class MoveFolderDto {
  @IsOptional() @IsUUID()
  newParentId?: string;
}

export class MoveDocumentToFolderDto {
  @IsUUID()
  documentId: string;

  @IsOptional() @IsUUID()
  folderId?: string;
}
