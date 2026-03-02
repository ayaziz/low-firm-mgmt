import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  caseId?: string;

  @IsOptional() @IsString()
  parentId?: string;

  @IsOptional() @IsEnum(['Case', 'Global', 'Template'])
  scope?: string;

  @IsOptional() @IsString()
  description?: string;
}

export class UpdateFolderDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  description?: string;
}

export class MoveFolderDto {
  @IsOptional() @IsString()
  newParentId?: string;
}

export class MoveDocumentToFolderDto {
  @IsString()
  documentId: string;

  @IsOptional() @IsString()
  folderId?: string;
}
