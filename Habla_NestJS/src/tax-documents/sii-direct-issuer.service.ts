import { Injectable } from '@nestjs/common';
import {
  DocumentStatus,
  Prisma,
  TaxDocument,
  TaxDocumentType,
  TaxProvider,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BOLETA_AFECTA,
  BOLETA_EXENTA,
  buildSignedBoleta,
  buildSignedEnvioBoleta,
} from '../sii/sii-boleta';
import { SiiBoletaClient } from '../sii/sii-boleta-client';
import { parseCaf } from '../sii/sii-caf';
import { SiiSendingProfile, TaxProviderService } from '../tax-provider/tax-provider.service';

type DocumentToIssue = TaxDocument & {
  appointment: { id: string; professionalId: string; serviceNameSnapshot?: string | null };
};

// Emite boletas directo al SII con el certificado y los folios de cada profesional.
// Paso 1 (issue): asigna folio, firma y envía; el documento queda pendiente con su trackId.
// Paso 2 (syncStatus): consulta al SII y deja la boleta aceptada o fallida con el motivo.
@Injectable()
export class SiiDirectIssuerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxProviderService: TaxProviderService,
    private readonly client: SiiBoletaClient,
  ) {}

  getSendingProfile(professionalId: string) {
    return this.taxProviderService.getSiiSendingProfile(professionalId);
  }

  async issue(document: DocumentToIssue, profile: SiiSendingProfile, actorId: string) {
    if (document.type === TaxDocumentType.FACTURA) {
      throw new Error('La emisión directa al SII solo está disponible para boletas');
    }

    const professionalId = document.appointment.professionalId;
    const dteCode = document.taxExempt ? BOLETA_EXENTA : BOLETA_AFECTA;
    const folio = await this.assignFolio(document, professionalId, dteCode);
    const cafXml = await this.taxProviderService.getCafXmlForFolio(professionalId, dteCode, folio);

    if (!cafXml) {
      throw new Error(`No se encontró el archivo de folios para el folio ${folio}`);
    }

    const issuedAt = new Date();
    const signedBoleta = buildSignedBoleta(
      {
        dteCode,
        folio,
        issuedAt,
        amount: document.amount ?? 0,
        itemName:
          document.appointment.serviceNameSnapshot ||
          document.professionalTaxNote ||
          'Servicio profesional',
        emitter: {
          rut: profile.emitterRut,
          name: document.professionalTaxName ?? '',
          activity: profile.taxActivity,
          address: document.professionalTaxAddress ?? '',
          city: document.professionalTaxCity ?? '',
        },
        receiver: {
          rut: document.customerTaxId,
          name: document.customerTaxName,
          address: document.customerTaxAddress,
          city: document.customerTaxCity,
        },
      },
      parseCaf(cafXml),
      profile.keys,
    );
    const envelope = buildSignedEnvioBoleta(
      [signedBoleta],
      {
        emitterRut: profile.emitterRut,
        senderRut: profile.signerRut,
        resolutionDate: profile.resolutionDate,
        resolutionNumber: profile.resolutionNumber,
        signedAt: issuedAt,
      },
      profile.keys,
    );
    const token = await this.client.getToken(profile.keys, profile.environment);
    const upload = await this.client.upload(envelope, {
      emitterRut: profile.emitterRut,
      senderRut: profile.signerRut,
      token,
      environment: profile.environment,
    });

    return this.prisma.taxDocument.update({
      where: { id: document.id },
      data: {
        provider: TaxProvider.SII,
        dteCode,
        siiTrackId: upload.trackId,
        siiStatus: upload.state,
        siiStatusDetail: null,
        lastProviderSyncAt: issuedAt,
        providerPayload: {
          siiDirect: {
            status: 'SENT',
            environment: profile.environment,
            sentAt: issuedAt.toISOString(),
            resolutionNumber: profile.resolutionNumber,
            resolutionDate: profile.resolutionDate,
            signedXml: signedBoleta,
          },
        },
        events: {
          create: {
            actorId,
            type: 'SII_DIRECT_SENT',
            message: `Boleta folio ${folio} enviada al SII`,
            metadata: { folio, dteCode, trackId: upload.trackId, environment: profile.environment },
          },
        },
      },
    });
  }

  // Consulta al SII una boleta enviada. Devuelve el documento actualizado y el resultado.
  async syncStatus(documentId: string) {
    const document = await this.prisma.taxDocument.findUnique({
      where: { id: documentId },
      include: { appointment: { select: { professionalId: true } } },
    });

    if (!document?.siiTrackId || document.status !== DocumentStatus.DOCUMENT_PENDING) {
      return null;
    }

    const professionalId = document.appointment.professionalId;
    const profile = await this.taxProviderService.getSiiSendingProfile(professionalId);

    if (!profile) return null;

    const token = await this.client.getToken(profile.keys, profile.environment);
    const status = await this.client.getStatus({
      emitterRut: profile.emitterRut,
      trackId: document.siiTrackId,
      token,
      environment: profile.environment,
    });
    const now = new Date();

    if (status.outcome === 'PENDING') {
      const updated = await this.prisma.taxDocument.update({
        where: { id: document.id },
        data: { siiStatus: status.state, lastProviderSyncAt: now },
      });
      return { document: updated, outcome: status.outcome };
    }

    const accepted = status.outcome === 'ACCEPTED';
    const updated = await this.prisma.taxDocument.update({
      where: { id: document.id },
      data: {
        status: accepted ? DocumentStatus.DOCUMENT_GENERATED : DocumentStatus.DOCUMENT_FAILED,
        siiStatus: status.state,
        siiStatusDetail: status.detail,
        generatedAt: accepted ? now : document.generatedAt,
        lastProviderSyncAt: now,
        // Si el SII la rechaza se borra el trackId para poder reenviarla con el mismo folio.
        siiTrackId: accepted ? document.siiTrackId : null,
        providerResponse: status.raw as Prisma.InputJsonValue,
        events: {
          create: {
            actorId: professionalId,
            type: accepted ? 'SII_DIRECT_ACCEPTED' : 'SII_DIRECT_REJECTED',
            message: accepted
              ? `El SII aceptó la boleta folio ${document.folio}`
              : `El SII rechazó la boleta folio ${document.folio}: ${status.detail}`,
            metadata: { trackId: document.siiTrackId, state: status.state },
          },
        },
      },
    });

    return { document: updated, outcome: status.outcome };
  }

  // El folio se reserva y se guarda en la boleta en la misma transacción: un reintento
  // reutiliza el mismo folio y dos pagos simultáneos nunca reciben el mismo número.
  private async assignFolio(document: TaxDocument, professionalId: string, dteCode: number) {
    if (document.folio) return Number(document.folio);

    return this.prisma.$transaction(async (tx) => {
      const [reservation] = await tx.$queryRaw<{ assignedFolio: number }[]>`
        UPDATE "ProfessionalTaxFolioRange"
        SET "nextFolio" = "nextFolio" + 1,
            "updatedAt" = NOW()
        WHERE "id" = (
          SELECT "id"
          FROM "ProfessionalTaxFolioRange"
          WHERE "professionalId" = ${professionalId}
            AND "provider" = ${TaxProvider.SII}::"TaxProvider"
            AND "dteCode" = ${dteCode}
            AND "status" = 'ACTIVE'
            AND "nextFolio" <= "endFolio"
          ORDER BY "nextFolio" ASC, "createdAt" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING "nextFolio" - 1 AS "assignedFolio"
      `;

      if (!reservation) {
        throw new Error(`No quedan folios tipo ${dteCode}. Pide más en sii.cl y súbelos a tu perfil.`);
      }

      const folio = Number(reservation.assignedFolio);
      const saved = await tx.taxDocument.updateMany({
        where: { id: document.id, folio: null },
        data: { folio: String(folio), dteCode },
      });

      if (saved.count === 0) {
        throw new Error('La boleta ya tiene un folio asignado');
      }

      return folio;
    });
  }
}
