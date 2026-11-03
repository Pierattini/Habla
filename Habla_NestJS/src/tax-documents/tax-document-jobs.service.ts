import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  DocumentMode,
  DocumentStatus,
  Prisma,
  Role,
  TaxDocumentJobStatus,
  TaxProvider,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TaxDocumentsService } from './tax-documents.service';

const TAX_DOCUMENT_JOB_TYPE = 'LIBREDTE_AUTO_ISSUE';

@Injectable()
export class TaxDocumentJobsService {
  private readonly maxAttempts = Number(
    process.env.TAX_DOCUMENT_JOB_MAX_ATTEMPTS || 3,
  );
  private readonly staleLockMs = Number(
    process.env.TAX_DOCUMENT_JOB_STALE_LOCK_MS || 15 * 60 * 1000,
  );
  private readonly batchSize = Number(
    process.env.TAX_DOCUMENT_JOB_BATCH_SIZE || 3,
  );
  private processing = false;
  private syncingSii = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly taxDocumentsService: TaxDocumentsService,
  ) {}

  async enqueueAutomaticIssue(
    appointmentId: string,
    options: { retry?: boolean } = {},
  ) {
    const document = await this.prisma.taxDocument.findUnique({
      where: { appointmentId },
      include: {
        appointment: {
          include: {
            professional: {
              include: {
                professional: true,
              },
            },
          },
        },
      },
    });

    if (!document) return null;
    if (!document.appointment.documentRequested) return null;
    if (document.mode !== DocumentMode.AUTOMATED) return null;
    if (!document.appointment.professional.professional?.documentAutomationEnabled) {
      return null;
    }

    const alreadyDone = !!(
      document.providerDocumentId ||
      document.siiTrackId ||
      (document.folio && document.provider !== TaxProvider.SII) ||
      document.status === DocumentStatus.DOCUMENT_GENERATED ||
      document.status === DocumentStatus.DOCUMENT_SENT ||
      document.status === DocumentStatus.DOCUMENT_UPLOADED
    );

    if (alreadyDone) return null;

    return this.prisma.taxDocumentJob.upsert({
      where: {
        appointmentId_type: {
          appointmentId,
          type: TAX_DOCUMENT_JOB_TYPE,
        },
      },
      create: {
        appointmentId,
        documentId: document.id,
        type: TAX_DOCUMENT_JOB_TYPE,
        status: TaxDocumentJobStatus.PENDING,
        maxAttempts: this.maxAttempts,
        nextRunAt: new Date(),
      },
      update: {
        documentId: document.id,
        maxAttempts: this.maxAttempts,
        nextRunAt: new Date(),
        ...(document.status === DocumentStatus.DOCUMENT_FAILED || options.retry
          ? {
              status: TaxDocumentJobStatus.PENDING,
              attempts: 0,
              errorCode: null,
              errorMessage: null,
              errorPayload: Prisma.DbNull,
            }
          : {}),
      },
    });
  }

  async retryFailedIssue(documentId: string, user: { id: string; role: Role }) {
    const appointmentId = await this.taxDocumentsService.resetFailedAutomaticIssue(
      documentId,
      user,
    );
    await this.enqueueAutomaticIssue(appointmentId, { retry: true });

    return this.prisma.taxDocument.findUnique({ where: { id: documentId } });
  }

  // Consulta en el SII las boletas enviadas que aún no tienen respuesta. Todo queda en la
  // base de datos, así que si el servidor se duerme se retoma al despertar.
  @Cron('*/30 * * * * *')
  async syncPendingSiiDocuments() {
    if (this.syncingSii) return;

    this.syncingSii = true;

    try {
      const documents = await this.prisma.taxDocument.findMany({
        where: {
          provider: TaxProvider.SII,
          status: DocumentStatus.DOCUMENT_PENDING,
          siiTrackId: { not: null },
          lastProviderSyncAt: { lte: new Date(Date.now() - 30_000) },
        },
        select: { id: true },
        orderBy: { lastProviderSyncAt: 'asc' },
        take: this.batchSize,
      });

      // Boletas ya aceptadas cuyo PDF o correo falló: se reintenta cada 5 minutos.
      const undelivered = await this.prisma.taxDocument.findMany({
        where: {
          provider: TaxProvider.SII,
          status: DocumentStatus.DOCUMENT_GENERATED,
          emailSent: false,
          lastProviderSyncAt: { lte: new Date(Date.now() - 5 * 60_000) },
        },
        select: { id: true },
        orderBy: { lastProviderSyncAt: 'asc' },
        take: this.batchSize,
      });

      for (const document of documents) {
        await this.runSiiStep(document.id, 'consultar el estado en el SII', () =>
          this.taxDocumentsService.syncSiiDirectStatus(document.id),
        );
      }

      for (const document of undelivered) {
        await this.runSiiStep(document.id, 'entregar la boleta al paciente', () =>
          this.taxDocumentsService.deliverSiiDirectDocument(document.id),
        );
      }
    } finally {
      this.syncingSii = false;
    }
  }

  private async runSiiStep(documentId: string, action: string, step: () => Promise<unknown>) {
    try {
      await step();
    } catch (error) {
      // Se reintenta en una próxima vuelta; se marca la hora para no insistir en bucle.
      await this.prisma.taxDocument.update({
        where: { id: documentId },
        data: { lastProviderSyncAt: new Date() },
      });
      console.error(`No se pudo ${action}`, documentId, error);
    }
  }

  @Cron('*/10 * * * * *')
  async processDueJobs() {
    if (this.processing) return;

    this.processing = true;

    try {
      const jobs = await this.findDueJobs();

      for (const job of jobs) {
        await this.processJob(job.id);
      }
    } finally {
      this.processing = false;
    }
  }

  private findDueJobs() {
    const now = new Date();
    const staleBefore = new Date(Date.now() - this.staleLockMs);

    return this.prisma.taxDocumentJob.findMany({
      where: {
        type: TAX_DOCUMENT_JOB_TYPE,
        OR: [
          {
            status: {
              in: [TaxDocumentJobStatus.PENDING, TaxDocumentJobStatus.RETRY],
            },
            nextRunAt: {
              lte: now,
            },
          },
          {
            status: TaxDocumentJobStatus.PROCESSING,
            lockedAt: {
              lt: staleBefore,
            },
          },
        ],
      },
      orderBy: [{ nextRunAt: 'asc' }, { createdAt: 'asc' }],
      take: this.batchSize,
    });
  }

  private async processJob(jobId: string) {
    const lockToken = randomUUID();
    const startedAt = new Date();

    const claimed = await this.prisma.taxDocumentJob.updateMany({
      where: {
        id: jobId,
        status: {
          in: [
            TaxDocumentJobStatus.PENDING,
            TaxDocumentJobStatus.RETRY,
            TaxDocumentJobStatus.PROCESSING,
          ],
        },
      },
      data: {
        status: TaxDocumentJobStatus.PROCESSING,
        lockedAt: startedAt,
        lockToken,
        startedAt,
        finishedAt: null,
        durationMs: null,
        attempts: {
          increment: 1,
        },
      },
    });

    if (claimed.count === 0) return;

    const job = await this.prisma.taxDocumentJob.findUnique({
      where: { id: jobId },
    });

    if (!job || job.lockToken !== lockToken) return;

    const finalAttempt = job.attempts >= job.maxAttempts;

    try {
      await this.taxDocumentsService.issueAutomaticForConfirmedPayment(
        job.appointmentId,
        {
          finalAttempt,
          jobId: job.id,
        },
      );

      await this.prisma.taxDocumentJob.update({
        where: { id: job.id },
        data: {
          status: TaxDocumentJobStatus.COMPLETED,
          finishedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
          lockedAt: null,
          lockToken: null,
          errorCode: null,
          errorMessage: null,
          errorPayload: Prisma.DbNull,
        },
      });
    } catch (error) {
      await this.handleJobError(job, startedAt, error);
    }
  }

  private async handleJobError(
    job: {
      id: string;
      attempts: number;
      maxAttempts: number;
    },
    startedAt: Date,
    error: unknown,
  ) {
    const finalAttempt = job.attempts >= job.maxAttempts;
    const errorPayload = this.serializeError(error);

    await this.prisma.taxDocumentJob.update({
      where: { id: job.id },
      data: {
        status: finalAttempt
          ? TaxDocumentJobStatus.FAILED
          : TaxDocumentJobStatus.RETRY,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        lockedAt: null,
        lockToken: null,
        nextRunAt: finalAttempt
          ? new Date()
          : new Date(Date.now() + this.getBackoffMs(job.attempts)),
        errorCode: errorPayload.code,
        errorMessage: errorPayload.message,
        errorPayload: errorPayload as Prisma.InputJsonValue,
      },
    });
  }

  private getBackoffMs(attempt: number) {
    const baseMs = Number(process.env.TAX_DOCUMENT_JOB_BACKOFF_MS || 30_000);

    return baseMs * Math.pow(2, Math.max(0, attempt - 1));
  }

  private serializeError(error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'getResponse' in error &&
      typeof (error as { getResponse?: unknown }).getResponse === 'function'
    ) {
      const response = (error as { getResponse: () => unknown }).getResponse();
      const record =
        response && typeof response === 'object'
          ? (response as Record<string, unknown>)
          : {};

      return {
        code: String(record['status'] || record['code'] || 'JOB_ERROR'),
        message: String(record['message'] || 'Tax document job failed'),
        response,
      };
    }

    return {
      code: 'JOB_ERROR',
      message:
        error instanceof Error ? error.message : 'Tax document job failed',
      response:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { error: String(error) },
    };
  }
}
