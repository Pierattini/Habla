import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  DocumentMode,
  DocumentStatus,
  Role,
  TaxDocumentJobStatus,
} from '@prisma/client';
import { TaxDocumentJobsService } from './tax-document-jobs.service';
import { TaxDocumentsService } from './tax-documents.service';

describe('retry of a failed automatic tax document', () => {
  const professional = { id: 'professional-1', role: Role.PROFESSIONAL };
  const failedDocument = {
    id: 'doc-1',
    appointmentId: 'appointment-1',
    mode: DocumentMode.AUTOMATED,
    status: DocumentStatus.DOCUMENT_FAILED,
    siiStatus: 'MISSING_TAX_PROVIDER_CREDENTIALS',
    siiStatusDetail: 'Credenciales no configuradas',
    folio: null,
    providerDocumentId: null,
    appointment: {
      id: 'appointment-1',
      professionalId: 'professional-1',
      documentRequested: true,
      professional: { professional: { documentAutomationEnabled: true } },
    },
  };

  let prisma: any;
  let documents: TaxDocumentsService;
  let jobs: TaxDocumentJobsService;

  beforeEach(() => {
    prisma = {
      taxDocument: {
        findUnique: jest.fn().mockResolvedValue(failedDocument),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      taxDocumentEvent: { create: jest.fn() },
      taxDocumentJob: { upsert: jest.fn() },
    };
    const none = {} as any;
    documents = new TaxDocumentsService(prisma, none, none, none, none, none, none);
    jobs = new TaxDocumentJobsService(prisma, documents);
  });

  it('puts the document back to pending and re-queues the job with fresh attempts', async () => {
    // Al reencolar, el documento ya está PENDING: los intentos deben reiniciarse igual.
    prisma.taxDocument.findUnique
      .mockResolvedValueOnce(failedDocument)
      .mockResolvedValueOnce({ ...failedDocument, status: DocumentStatus.DOCUMENT_PENDING });

    await jobs.retryFailedIssue('doc-1', professional);

    expect(prisma.taxDocument.updateMany).toHaveBeenCalledWith({
      where: { id: 'doc-1', status: DocumentStatus.DOCUMENT_FAILED },
      data: expect.objectContaining({ status: DocumentStatus.DOCUMENT_PENDING }),
    });
    expect(prisma.taxDocumentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'DOCUMENT_RETRY_REQUESTED' }),
    });
    expect(prisma.taxDocumentJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: TaxDocumentJobStatus.PENDING,
          attempts: 0,
        }),
      }),
    );
  });

  it('rejects documents that did not fail', async () => {
    prisma.taxDocument.findUnique.mockResolvedValue({
      ...failedDocument,
      status: DocumentStatus.DOCUMENT_GENERATED,
    });

    await expect(jobs.retryFailedIssue('doc-1', professional)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.taxDocumentJob.upsert).not.toHaveBeenCalled();
  });

  it('does not re-queue twice when two retries arrive together', async () => {
    prisma.taxDocument.updateMany.mockResolvedValue({ count: 0 });

    await expect(jobs.retryFailedIssue('doc-1', professional)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.taxDocumentJob.upsert).not.toHaveBeenCalled();
  });

  it('only lets the owner professional retry', async () => {
    await expect(
      jobs.retryFailedIssue('doc-1', { id: 'other', role: Role.PROFESSIONAL }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
