import { TaxDocumentType } from '@prisma/client';

export type LibreDteDocumentKind =
  | 'BOLETA_AFECTA'
  | 'BOLETA_EXENTA'
  | 'FACTURA_AFECTA'
  | 'FACTURA_EXENTA';

export type LibreDteResourceFormat = 'pdf' | 'xml';

export interface LibreDteParty {
  rut: string;
  name: string;
  email?: string | null;
  address: string;
  city?: string | null;
  country?: string | null;
}

export interface LibreDteIssueInput {
  documentId: string;
  kind: LibreDteDocumentKind;
  type?: TaxDocumentType | null;
  amount: number;
  currency: string;
  customer: LibreDteParty;
  issuer: LibreDteParty;
  appointmentDate: Date;
}

export interface LibreDteIssueResult {
  dteCode: number;
  folio?: string | null;
  providerDocumentId?: string | null;
  siiTrackId?: string | null;
  siiStatus?: string | null;
  siiStatusDetail?: string | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  providerPayload: Record<string, unknown>;
  providerResponse: unknown;
}

export interface LibreDteStatusResult {
  siiStatus?: string | null;
  siiStatusDetail?: string | null;
  siiTrackId?: string | null;
  providerResponse: unknown;
}
