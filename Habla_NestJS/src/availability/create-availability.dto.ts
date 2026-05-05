import { IsEnum, IsInt, Min, Max } from 'class-validator';
import { WeekDay } from '@prisma/client';

export class CreateAvailabilityDto {
  @IsEnum(WeekDay)
  day: WeekDay;

  @IsInt()
  @Min(0)
  @Max(1440)
  startMinute: number;

  @IsInt()
  @Min(0)
  @Max(1440)
  endMinute: number;
}
