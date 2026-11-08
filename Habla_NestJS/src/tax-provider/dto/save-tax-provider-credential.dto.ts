import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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

  // Solo se exige al subir un certificado nuevo.
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  certificatePassword?: string;

  // RUT personal de quien firma (dueño del certificado).
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  signerRut?: string;

  // Giro de la empresa, tal como aparece en el SII.
  @IsOptional()
  @IsString()
  @MaxLength(80)
  taxActivity?: string;

  // Llega como texto porque el formulario es multipart.
  @IsOptional()
  @Matches(/^\d{1,9}$/)
  resolutionNumber?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  resolutionDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['CERTIFICATION', 'PRODUCTION'])
  environment?: 'CERTIFICATION' | 'PRODUCTION';
}
