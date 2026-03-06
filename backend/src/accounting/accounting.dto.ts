import { IsString, IsOptional, IsNumber, IsEnum, IsArray, ValidateNested, IsDateString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

// --- Invoices ---
export class InvoiceLineItemDto {
  @IsString() description: string;
  @IsNumber() quantity: number;
  @IsNumber() unitPrice: number;
  @IsOptional() @IsNumber() taxRate?: number;
}

export class CreateInvoiceDto {
  @IsOptional() @IsUUID() caseId?: string;
  @IsUUID() customerId: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumber() discountRatePct?: number;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems: InvoiceLineItemDto[];
}

export class VoidInvoiceDto {
  @IsString() reason: string;
}

// --- Payments ---
export class CreatePaymentDto {
  @IsUUID() invoiceId: string;
  @IsNumber() amount: number;
  @IsEnum(['Cash', 'BankTransfer', 'Cheque', 'Card', 'Other']) method: string;
  @IsOptional() @IsDateString() paymentDate?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() notes?: string;
}

// --- Expenses ---
export class CreateExpenseDto {
  @IsOptional() @IsUUID() caseId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsNumber() amount: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() expenseDate?: string;
  @IsOptional() @IsUUID() receiptDocId?: string;
}

export class ApproveExpenseDto {
  @IsOptional() @IsString() comment?: string;
}

export class RejectExpenseDto {
  @IsString() reason: string;
}

// --- Wages ---
export class CreateWageDto {
  @IsUUID() userId: string;
  @IsNumber() amount: number;
  @IsString() period: string; // e.g., "2024-01"
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() staffName?: string;
  @IsOptional() @IsNumber() deductions?: number;
  @IsOptional() @IsNumber() grossAmount?: number;
  @IsOptional() @IsNumber() netAmount?: number;
  @IsOptional() @IsEnum(['Draft', 'Submitted', 'Approved', 'Paid']) paymentStatus?: string;
}

export class UpdateWageDto {
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsString() period?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() staffName?: string;
  @IsOptional() @IsNumber() deductions?: number;
  @IsOptional() @IsNumber() grossAmount?: number;
  @IsOptional() @IsNumber() netAmount?: number;
}

// --- Wage Approval ---
export class WageActionDto {
  @IsOptional() @IsString() comment?: string;
}

export class RejectWageDto {
  @IsString() reason: string;
}

// --- Invoice Review ---
export class InvoiceReviewActionDto {
  @IsOptional() @IsString() comment?: string;
}

export class RejectInvoiceReviewDto {
  @IsString() reason: string;
}

export class UpdateExpenseDto {
  @IsOptional() @IsUUID() caseId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() expenseDate?: string;
  @IsOptional() @IsUUID() receiptDocId?: string;
}

export class UpdateInvoiceDto {
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumber() discountRatePct?: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems?: InvoiceLineItemDto[];
}

export class UpdatePaymentDto {
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsEnum(['Cash', 'BankTransfer', 'Cheque', 'Card', 'Other']) method?: string;
  @IsOptional() @IsDateString() paymentDate?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() notes?: string;
}
