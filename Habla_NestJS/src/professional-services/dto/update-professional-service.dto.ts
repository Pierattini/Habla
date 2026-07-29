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

export class UpdateProfessionalServiceDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes?: number;

  @IsOptional()
  @IsEnum(ProfessionalServicePriceType)
  priceType?: ProfessionalServicePriceType;

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
  icon?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  imageUrl?: string | null;

  @IsOptional()
  @IsHexColor()
  color?: string | null;

  @IsOptional()
  @IsBoolean()
  showInProfile?: boolean;

  @IsOptional()
  @IsBoolean()
  allowBooking?: boolean;
}
