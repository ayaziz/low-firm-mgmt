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
  @IsUUID() caseId: string;
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
  @IsEnum(['Cash', 'BankTransfer', 'Cheque', 'CreditCard', 'Other']) method: string;
  @IsOptional() @IsDateString() paymentDate?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() notes?: string;
}

// --- Expenses ---
export class CreateExpenseDto {
  @IsUUID() caseId: string;
  @IsUUID() categoryId: string;
  @IsNumber() amount: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() expenseDate?: string;
  @IsOptional() @IsString() receiptDocId?: string;
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
}
