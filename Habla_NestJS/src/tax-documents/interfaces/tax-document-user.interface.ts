import { Role } from '@prisma/client';

export interface TaxDocumentUser {
  id: string;
  email?: string;
  role: Role;
}
