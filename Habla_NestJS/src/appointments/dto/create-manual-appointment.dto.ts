import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateManualAppointmentDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  guestCustomerName?: string;

  @IsDateString()
  startAt!: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;
}
