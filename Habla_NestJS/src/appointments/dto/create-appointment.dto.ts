import { IsDateString, IsUUID } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  professionalId: string;

  @IsDateString()
  date: string;
}
