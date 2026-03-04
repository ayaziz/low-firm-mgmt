import { IsString, IsOptional, IsEnum, IsBoolean, IsObject, MaxLength, IsUUID } from 'class-validator';
import { DocumentTemplateCategory } from '../common/types';

export class CreateTemplateDto {
  @IsString()
  @MaxLength(500)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['Contract', 'Letter', 'Petition', 'Motion', 'Filing', 'Other'])
  category: DocumentTemplateCategory;

  @IsString()
  templateBody: string;

  @IsOptional()
  @IsObject()
  variableSchema?: Record<string, string>;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['Contract', 'Letter', 'Petition', 'Motion', 'Filing', 'Other'])
  category?: DocumentTemplateCategory;

  @IsOptional()
  @IsString()
  templateBody?: string;

  @IsOptional()
  @IsObject()
  variableSchema?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RenderTemplateDto {
  @IsUUID()
  templateId: string;

  @IsObject()
  data: Record<string, any>;

  /** If caseId is provided, a document will be created from the rendered output */
  @IsOptional()
  @IsUUID()
  caseId?: string;

  /** Document title when generating a document (defaults to template name) */
  @IsOptional()
  @IsString()
  title?: string;
}
