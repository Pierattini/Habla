import { Injectable } from '@nestjs/common';
import { TaxDocumentType } from '@prisma/client';
import {
  LibreDteDocumentKind,
  LibreDteIssueInput,
  LibreDteParty,
} from './libredte.types';

@Injectable()
export class LibreDteMapper {
  getDteCode(kind: LibreDteDocumentKind): number {
    const codes: Record<LibreDteDocumentKind, number> = {
      BOLETA_AFECTA: 39,
      BOLETA_EXENTA: 41,
      FACTURA_AFECTA: 33,
      FACTURA_EXENTA: 34,
    };

    return codes[kind];
  }

  getDocumentType(kind: LibreDteDocumentKind): TaxDocumentType {
    return kind.startsWith('FACTURA')
      ? TaxDocumentType.FACTURA
      : TaxDocumentType.BOLETA;
  }

  resolveKind(type?: TaxDocumentType | null): LibreDteDocumentKind {
    return type === TaxDocumentType.FACTURA
      ? 'FACTURA_AFECTA'
      : 'BOLETA_AFECTA';
  }

  buildIssuePayload(input: LibreDteIssueInput): Record<string, unknown> {
    const dteCode = this.getDteCode(input.kind);

    return {
      dte: dteCode,
      documentoId: input.documentId,
      moneda: input.currency,
      fechaEmision: new Date().toISOString().slice(0, 10),
      fechaCita: input.appointmentDate.toISOString(),
      emisor: this.mapParty(input.issuer),
      receptor: this.mapParty(input.customer),
      detalle: [
        {
          nombre: 'Servicio profesional Conecta',
          cantidad: 1,
          precio: input.amount,
          total: input.amount,
        },
      ],
      totales: {
        montoTotal: input.amount,
      },
    };
  }

  private mapParty(party: LibreDteParty) {
    return {
      rut: party.rut,
      razonSocial: party.name,
      email: party.email || undefined,
      direccion: party.address,
      comuna: party.city || undefined,
      pais: party.country || 'CL',
    };
  }
}
