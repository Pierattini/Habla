import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SaveTaxProviderCredentialDto {
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  rut: string;

  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(400)
  apiToken?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(200)
  certificatePassword: string;

  @IsOptional()
  @IsString()
  @IsIn(['CERTIFICATION', 'PRODUCTION'])
  environment?: 'CERTIFICATION' | 'PRODUCTION';
}
