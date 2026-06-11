import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DocumentMode, TaxDocumentType } from '@prisma/client';

export class CreateTaxDocumentDto {
  @IsUUID()
  appointmentId: string;

  @IsOptional()
  @IsEnum(DocumentMode)
  mode?: DocumentMode;

  @IsOptional()
  @IsEnum(TaxDocumentType)
  type?: TaxDocumentType;

  @IsOptional()
  @IsString()
  currency?: string;
}
