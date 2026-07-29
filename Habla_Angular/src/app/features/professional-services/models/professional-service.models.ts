export type ProfessionalServiceMode = 'SINGLE_PRICE' | 'SERVICE_CATALOG';
export type ProfessionalServicePriceType = 'FIXED' | 'FROM' | 'CONSULT' | 'FREE';
export type ProfessionalServiceStatus = 'ACTIVE' | 'INACTIVE';

export interface ProfessionalService {
  id: string;
  professionalId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceType: ProfessionalServicePriceType;
  priceAmount: number | null;
  currency: string;
  status: ProfessionalServiceStatus;
  sortOrder: number;
  icon: string | null;
  imageUrl: string | null;
  color: string | null;
  showInProfile: boolean;
  allowBooking: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type PublicProfessionalService = Pick<
  ProfessionalService,
  | 'id'
  | 'name'
  | 'description'
  | 'durationMinutes'
  | 'priceType'
  | 'priceAmount'
  | 'currency'
  | 'sortOrder'
  | 'icon'
  | 'imageUrl'
  | 'color'
  | 'allowBooking'
>;

export interface ProfessionalServicesCatalog {
  serviceMode: ProfessionalServiceMode;
  data: ProfessionalService[];
}

export interface PublicProfessionalServicesCatalog {
  serviceMode: ProfessionalServiceMode;
  data: PublicProfessionalService[];
}

export interface CreateProfessionalServicePayload {
  name: string;
  description?: string;
  durationMinutes: number;
  priceType: ProfessionalServicePriceType;
  priceAmount?: number | null;
  currency?: string;
  status?: ProfessionalServiceStatus;
  icon?: string;
  imageUrl?: string;
  color?: string;
  showInProfile?: boolean;
  allowBooking?: boolean;
}

export interface UpdateProfessionalServicePayload extends Partial<
  Omit<CreateProfessionalServicePayload, 'description' | 'icon' | 'imageUrl' | 'color'>
> {
  description?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  color?: string | null;
}

export interface ProfessionalServiceModeResponse {
  serviceMode: ProfessionalServiceMode;
}
