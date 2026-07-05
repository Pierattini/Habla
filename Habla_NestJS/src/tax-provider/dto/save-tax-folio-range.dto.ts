import { IsIn, IsOptional, IsString } from 'class-validator';

export class SaveTaxFolioRangeDto {
  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';
}
