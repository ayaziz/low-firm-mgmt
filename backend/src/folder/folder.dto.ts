import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  name: string;

  @IsEnum(['case', 'customer', 'tenant'])
  scopeType: string;

  @IsUUID()
  scopeId: string;

  @IsOptional() @IsUUID()
  parentId?: string;
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
