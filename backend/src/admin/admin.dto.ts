import { IsString, IsOptional, IsArray, IsBoolean, IsEnum, IsInt, IsObject, Min, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsString() email: string;
  @IsString() displayName: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) roles: string[];
  @IsOptional() @IsEnum(['en', 'ar']) language?: 'en' | 'ar';
}

export class UpdateUserDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) roles?: string[];
  @IsOptional() @IsString() displayName?: string;
}

export class CreateMasterDataDto {
  @IsString() code: string;
  @IsString() labelEn: string;
  @IsOptional() @IsString() labelAr?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsObject() config?: Record<string, any>;
}

export class UpdateMasterDataDto {
  @IsOptional() @IsString() labelEn?: string;
  @IsOptional() @IsString() labelAr?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsObject() config?: Record<string, any>;
}

export class WorkflowStepDto {
  @IsInt() stepOrder: number;
  @IsString() approverRole: string;
}

export class SaveExpenseWorkflowDto {
  @IsOptional() @IsString() name?: string;
  @IsArray() @ArrayMinSize(1) @Type(() => WorkflowStepDto) steps: WorkflowStepDto[];
}

export class UpdateTenantSettingsDto {
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() locale?: string;
  @IsOptional() @IsEnum(['Standard', 'Enterprise']) planTier?: string;
  @IsOptional() @IsBoolean() lawyerCanDraft?: boolean;
}
