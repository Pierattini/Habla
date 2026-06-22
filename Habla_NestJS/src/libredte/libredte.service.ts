import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentStatus, TaxDocumentType } from '@prisma/client';
import { LibreDteClient } from './libredte.client';
import { LibreDteMapper } from './libredte.mapper';
import {
  LibreDteDocumentKind,
  LibreDteIssueInput,
  LibreDteParty,
  LibreDteResourceFormat,
} from './libredte.types';

type TaxDocumentForIssue = {
  id: string;
  type?: TaxDocumentType | null;
  amount?: number | null;
  currency: string;
  customerTaxId?: string | null;
  customerTaxName?: string | null;
  customerTaxEmail?: string | null;
  customerTaxAddress?: string | null;
  customerTaxCountry?: string | null;
  customerTaxCity?: string | null;
  professionalTaxId?: string | null;
  professionalTaxName?: string | null;
  professionalTaxEmail?: string | null;
  professionalTaxAddress?: string | null;
  professionalTaxCountry?: string | null;
  professionalTaxCity?: string | null;
  appointment: {
    date: Date;
  };
};

@Injectable()
export class LibreDteService {
  constructor(
    private readonly client: LibreDteClient,
    private readonly mapper: LibreDteMapper,
  ) {}

  getDocumentType(kind?: LibreDteDocumentKind, fallback?: TaxDocumentType | null) {
    return this.mapper.getDocumentType(kind || this.mapper.resolveKind(fallback));
  }

  async issueDocument(
    document: TaxDocumentForIssue,
    kind?: LibreDteDocumentKind,
  ) {
    const resolvedKind = kind || this.mapper.resolveKind(document.type);
    const input: LibreDteIssueInput = {
      documentId: document.id,
      kind: resolvedKind,
      type: document.type,
      amount: this.requireAmount(document.amount),
      currency: document.currency || 'CLP',
      customer: this.buildCustomer(document),
      issuer: this.buildIssuer(document),
      appointmentDate: document.appointment.date,
    };
    const payload = this.mapper.buildIssuePayload(input);

    return this.client.issue(payload);
  }

  syncStatus(providerDocumentId: string) {
    return this.client.getStatus(providerDocumentId);
  }

  getResourceUrl(providerDocumentId: string, format: LibreDteResourceFormat) {
    return this.client.getResourceUrl(providerDocumentId, format);
  }

  getSuccessStatus(resultStatus?: string | null): DocumentStatus {
    const normalized = (resultStatus || '').toUpperCase();

    if (['RECHAZADO', 'REJECTED', 'ERROR', 'FAILED'].some((item) => normalized.includes(item))) {
      return DocumentStatus.DOCUMENT_FAILED;
    }

    return DocumentStatus.DOCUMENT_GENERATED;
  }

  private requireAmount(amount?: number | null): number {
    if (!amount || amount <= 0) {
      throw new BadRequestException('Document amount is required');
    }

    return amount;
  }

  private buildCustomer(document: TaxDocumentForIssue): LibreDteParty {
    return this.requireParty({
      rut: document.customerTaxId,
      name: document.customerTaxName,
      email: document.customerTaxEmail,
      address: document.customerTaxAddress,
      city: document.customerTaxCity,
      country: document.customerTaxCountry,
    }, 'customer');
  }

  private buildIssuer(document: TaxDocumentForIssue): LibreDteParty {
    return this.requireParty({
      rut: document.professionalTaxId,
      name: document.professionalTaxName,
      email: document.professionalTaxEmail,
      address: document.professionalTaxAddress,
      city: document.professionalTaxCity,
      country: document.professionalTaxCountry,
    }, 'professional');
  }

  private requireParty(
    party: {
      rut?: string | null;
      name?: string | null;
      email?: string | null;
      address?: string | null;
      city?: string | null;
      country?: string | null;
    },
    label: string,
  ): LibreDteParty {
    if (!party.rut || !party.name || !party.address) {
      throw new BadRequestException(
        `Missing ${label} tax data: rut, name and address are required`,
      );
    }

    return {
      rut: party.rut,
      name: party.name,
      email: party.email,
      address: party.address,
      city: party.city,
      country: party.country,
    };
  }
}
