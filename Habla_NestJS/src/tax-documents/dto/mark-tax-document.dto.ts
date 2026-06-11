import { IsOptional, IsString } from 'class-validator';

export class MarkTaxDocumentDto {
  @IsOptional()
  @IsString()
  message?: string;
}
