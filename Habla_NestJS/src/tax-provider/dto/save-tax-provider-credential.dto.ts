import { IsString, MaxLength, MinLength } from 'class-validator';

export class SaveTaxProviderCredentialDto {
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  rut: string;

  @IsString()
  @MinLength(12)
  @MaxLength(400)
  apiToken: string;
}
