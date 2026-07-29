import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ProfessionalServicePriceType,
  ProfessionalServiceStatus,
} from '@prisma/client';

export class CreateProfessionalServiceDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes!: number;

  @IsEnum(ProfessionalServicePriceType)
  priceType!: ProfessionalServicePriceType;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceAmount?: number | null;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsEnum(ProfessionalServiceStatus)
  status?: ProfessionalServiceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  imageUrl?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsBoolean()
  showInProfile?: boolean;

  @IsOptional()
  @IsBoolean()
  allowBooking?: boolean;
}
