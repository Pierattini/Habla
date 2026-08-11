export type ProfessionalTimeBlockType = 'TIME_RANGE' | 'FULL_DAY' | 'DATE_RANGE';

export interface ProfessionalTimeBlock {
  id: string;
  professionalId: string;
  startAt: string;
  endAt: string;
  type: ProfessionalTimeBlockType;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProfessionalTimeBlock {
  startAt: string;
  endAt: string;
  type: ProfessionalTimeBlockType;
  reason?: string;
}

