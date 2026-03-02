import { IsString, IsOptional, IsEnum, IsBoolean, IsObject, MaxLength } from 'class-validator';
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
  template_body: string;

  @IsOptional()
  @IsObject()
  variable_schema?: Record<string, string>;
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
  template_body?: string;

  @IsOptional()
  @IsObject()
  variable_schema?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class RenderTemplateDto {
  @IsString()
  templateId: string;

  @IsObject()
  data: Record<string, any>;

  /** If caseId is provided, a document will be created from the rendered output */
  @IsOptional()
  @IsString()
  caseId?: string;

  /** Document title when generating a document (defaults to template name) */
  @IsOptional()
  @IsString()
  title?: string;
}
