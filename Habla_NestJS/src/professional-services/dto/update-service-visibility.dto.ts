import { IsBoolean } from 'class-validator';

export class UpdateServiceVisibilityDto {
  @IsBoolean()
  showInProfile!: boolean;
}
