import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { TaxProvider } from '@prisma/client';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  taxName?: string;

  @IsOptional()
  @IsEmail()
  taxEmail?: string;

  @IsOptional()
  @IsString()
  taxAddress?: string;

  @IsOptional()
  @IsString()
  taxCountry?: string;

  @IsOptional()
  @IsString()
  taxCity?: string;

  @IsOptional()
  @IsBoolean()
  wantsTaxDocumentByDefault?: boolean;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  duration?: number;

  @IsOptional()
  @IsBoolean()
  documentAutomationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  manualDocumentMode?: boolean;

  @IsOptional()
  @IsEnum(TaxProvider)
  taxProvider?: TaxProvider;
}
