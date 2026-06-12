import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  ValidateNested,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ScheduleMode, WeekDay } from '@prisma/client';

export class AvailabilityRangeDto {
  @IsInt()
  @Min(0)
  @Max(1440)
  startMinute: number;

  @IsInt()
  @Min(0)
  @Max(1440)
  endMinute: number;
}

export class CreateAvailabilityDto {
  @IsEnum(WeekDay)
  day: WeekDay;

  @IsOptional()
  @IsEnum(ScheduleMode)
  scheduleMode?: ScheduleMode;

  @IsInt()
  @Min(0)
  @Max(1440)
  startMinute: number;

  @IsInt()
  @Min(0)
  @Max(1440)
  endMinute: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  breakMinute?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(1439, { each: true })
  specificSlots?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityRangeDto)
  blockedRanges?: AvailabilityRangeDto[];
}
