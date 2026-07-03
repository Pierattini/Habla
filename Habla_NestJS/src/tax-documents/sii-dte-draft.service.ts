import { BadRequestException, Injectable } from '@nestjs/common';
import { TaxDocumentType } from '@prisma/client';

type SiiDraftDocument = {
  id: string;
  type?: TaxDocumentType | null;
  amount?: number | null;
  currency: string;
  customerTaxId?: string | null;
  customerTaxName?: string | null;
  customerTaxAddress?: string | null;
  customerTaxCity?: string | null;
  professionalTaxId?: string | null;
  professionalTaxName?: string | null;
  professionalTaxAddress?: string | null;
  professionalTaxCity?: string | null;
  appointment: {
    id: string;
    date: Date;
  };
};

type SiiDraftResult = {
  dteCode: number;
  generatedAt: Date;
  xml: string;
  warnings: string[];
};

@Injectable()
export class SiiDteDraftService {
  buildDraft(document: SiiDraftDocument): SiiDraftResult {
    const generatedAt = new Date();
    const warnings: string[] = [];
    const dteCode = this.resolveDteCode(document.type);
    const amount = this.requirePositiveAmount(document.amount);
    const emitter = this.resolveEmitter(document);
    const receiver = this.resolveReceiver(document);
    const issueDate = this.formatDate(generatedAt);
    const serviceDate = this.formatDate(document.appointment.date);
    const documentId = `DTE-${document.id}`;

    if (document.currency !== 'CLP') {
      warnings.push('SII directo esta preparado inicialmente para CLP.');
    }

    const xml = [
      '<?xml version="1.0" encoding="ISO-8859-1"?>',
      '<DTE version="1.0">',
      `<Documento ID="${this.escapeXml(documentId)}">`,
      '<Encabezado>',
      '<IdDoc>',
      `<TipoDTE>${dteCode}</TipoDTE>`,
      '<Folio>0</Folio>',
      `<FchEmis>${issueDate}</FchEmis>`,
      '</IdDoc>',
      '<Emisor>',
      `<RUTEmisor>${this.escapeXml(emitter.rut)}</RUTEmisor>`,
      `<RznSocEmisor>${this.escapeXml(emitter.name)}</RznSocEmisor>`,
      `<GiroEmisor>${this.escapeXml('Servicios profesionales')}</GiroEmisor>`,
      `<DirOrigen>${this.escapeXml(emitter.address)}</DirOrigen>`,
      `<CmnaOrigen>${this.escapeXml(emitter.city)}</CmnaOrigen>`,
      '</Emisor>',
      '<Receptor>',
      `<RUTRecep>${this.escapeXml(receiver.rut)}</RUTRecep>`,
      `<RznSocRecep>${this.escapeXml(receiver.name)}</RznSocRecep>`,
      `<DirRecep>${this.escapeXml(receiver.address)}</DirRecep>`,
      `<CmnaRecep>${this.escapeXml(receiver.city)}</CmnaRecep>`,
      '</Receptor>',
      '<Totales>',
      `<MntTotal>${amount}</MntTotal>`,
      '</Totales>',
      '</Encabezado>',
      '<Detalle>',
      '<NroLinDet>1</NroLinDet>',
      '<NmbItem>Atencion profesional Conecta</NmbItem>',
      `<DscItem>Cita ${this.escapeXml(document.appointment.id)} - ${serviceDate}</DscItem>`,
      '<QtyItem>1</QtyItem>',
      `<PrcItem>${amount}</PrcItem>`,
      `<MontoItem>${amount}</MontoItem>`,
      '</Detalle>',
      '</Documento>',
      '</DTE>',
    ].join('');

    return {
      dteCode,
      generatedAt,
      xml,
      warnings,
    };
  }

  private resolveDteCode(type?: TaxDocumentType | null): number {
    if (type === TaxDocumentType.FACTURA) return 33;
    return 39;
  }

  private requirePositiveAmount(value?: number | null): number {
    const amount = Math.round(Number(value || 0));

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('El documento no tiene un monto valido');
    }

    return amount;
  }

  private resolveEmitter(document: SiiDraftDocument) {
    return {
      rut: this.requireValue(document.professionalTaxId, 'RUT emisor'),
      name: this.requireValue(document.professionalTaxName, 'razon social emisor'),
      address: this.requireValue(document.professionalTaxAddress, 'direccion emisor'),
      city: this.requireValue(document.professionalTaxCity, 'comuna emisor'),
    };
  }

  private resolveReceiver(document: SiiDraftDocument) {
    return {
      rut: this.requireValue(document.customerTaxId, 'RUT receptor'),
      name: this.requireValue(document.customerTaxName, 'nombre receptor'),
      address: this.requireValue(document.customerTaxAddress, 'direccion receptor'),
      city: this.requireValue(document.customerTaxCity, 'comuna receptor'),
    };
  }

  private requireValue(value: string | null | undefined, label: string): string {
    const normalized = value?.trim();

    if (!normalized) {
      throw new BadRequestException(`Falta ${label} para preparar el XML SII`);
    }

    return normalized;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
