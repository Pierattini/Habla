import { DocumentMode, DocumentStatus, TaxProvider } from '@prisma/client';
import { buildSignedBoleta } from '../sii/sii-boleta';
import { parseCaf } from '../sii/sii-caf';
import { createTestCaf, createTestCertificate } from '../sii/sii-test-fixtures';
import { TaxDocumentsService } from './tax-documents.service';

describe('TaxDocumentsService with direct SII issuing', () => {
  const { keys } = createTestCertificate();
  const signedXml = buildSignedBoleta(
    {
      dteCode: 41,
      folio: 16311,
      issuedAt: new Date('2026-10-28T15:00:00.000Z'),
      amount: 45_000,
      itemName: 'Sesión psicoterapia individual',
      emitter: {
        rut: '77761467-3',
        name: 'CRGARRIDO SPA',
        activity: 'Centro terapéutico',
        address: 'Tres Poniente 31',
        city: 'María Pinto',
      },
      receiver: { rut: '19243810-1', name: 'Paciente' },
    },
    parseCaf(createTestCaf(41).xml),
    keys,
  );
  const appointment = {
    id: 'appointment-1',
    professionalId: 'professional-1',
    documentRequested: true,
    date: new Date('2026-10-28T15:00:00.000Z'),
    customer: { id: 'customer-1', email: 'paciente@correo.cl', name: 'Paciente' },
    professional: {
      email: 'profesional@correo.cl',
      name: 'Carolina',
      professional: { name: 'Carolina', documentAutomationEnabled: true },
    },
  };
  const pendingDocument = {
    id: 'doc-1',
    appointmentId: 'appointment-1',
    mode: DocumentMode.AUTOMATED,
    status: DocumentStatus.DOCUMENT_PENDING,
    provider: null,
    providerDocumentId: null,
    siiTrackId: null,
    folio: null,
    emailSent: false,
    pdfUrl: null,
    appointment,
  };

  let prisma: any;
  let cloudinary: any;
  let email: any;
  let taxProvider: any;
  let siiIssuer: any;
  let service: TaxDocumentsService;

  beforeEach(() => {
    prisma = {
      taxDocument: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(({ data }) => Promise.resolve({ ...pendingDocument, ...data })),
      },
      taxDocumentEvent: { create: jest.fn() },
      appointment: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    cloudinary = {
      uploadTaxDocumentBuffer: jest.fn((_id: string, _buffer: Buffer, fileName: string) =>
        Promise.resolve({ secure_url: `https://files/${fileName}`, public_id: fileName }),
      ),
    };
    email = { sendTaxDocumentEmail: jest.fn().mockResolvedValue(undefined) };
    taxProvider = { getLibreDteTokenForProfessional: jest.fn().mockResolvedValue(null) };
    siiIssuer = {
      getSendingProfile: jest.fn().mockResolvedValue({ environment: 'CERTIFICATION' }),
      issue: jest.fn().mockResolvedValue({ ...pendingDocument, siiTrackId: '1014' }),
    };
    service = new TaxDocumentsService(
      prisma,
      cloudinary,
      email,
      {} as any,
      taxProvider,
      {} as any,
      siiIssuer,
    );
  });

  it('issues through the SII when the professional has no LibreDTE account', async () => {
    prisma.taxDocument.findUnique.mockResolvedValue(pendingDocument);

    await service.issueAutomaticForConfirmedPayment('appointment-1', { jobId: 'job-1' });

    expect(prisma.taxDocument.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ provider: TaxProvider.SII }) }),
    );
    expect(siiIssuer.issue).toHaveBeenCalled();
  });

  it('marks the boleta failed with the reason on the last attempt', async () => {
    prisma.taxDocument.findUnique.mockResolvedValue(pendingDocument);
    siiIssuer.issue.mockRejectedValue(new Error('No quedan folios tipo 41'));

    const result = await service.issueAutomaticForConfirmedPayment('appointment-1', {
      jobId: 'job-1',
      finalAttempt: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: DocumentStatus.DOCUMENT_FAILED,
        siiStatusDetail: 'No quedan folios tipo 41',
      }),
    );
  });

  it('retries with the same folio when the boleta never reached the SII', async () => {
    prisma.taxDocument.findUnique.mockResolvedValue({
      ...pendingDocument,
      provider: TaxProvider.SII,
      folio: '16311',
    });

    await service.issueAutomaticForConfirmedPayment('appointment-1', { jobId: 'job-1' });

    expect(siiIssuer.issue).toHaveBeenCalledWith(
      expect.objectContaining({ folio: '16311' }),
      expect.anything(),
      'professional-1',
    );
  });

  it('stores PDF and XML of an accepted boleta and emails the patient', async () => {
    prisma.taxDocument.findUnique.mockResolvedValue({
      ...pendingDocument,
      status: DocumentStatus.DOCUMENT_GENERATED,
      folio: '16311',
      providerPayload: {
        siiDirect: { signedXml, resolutionNumber: 80, resolutionDate: '2014-08-22' },
      },
    });

    await service.deliverSiiDirectDocument('doc-1');

    expect(cloudinary.uploadTaxDocumentBuffer.mock.calls.map((call: any[]) => call[2])).toEqual([
      'boleta-16311.pdf',
      'boleta-16311.xml',
    ]);
    expect(email.sendTaxDocumentEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        customerEmail: 'paciente@correo.cl',
        pdfUrl: 'https://files/boleta-16311.pdf',
      }),
    );
    expect(prisma.taxDocument.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: DocumentStatus.DOCUMENT_SENT, emailSent: true }),
      }),
    );
  });

  it('leaves the boleta for a later retry when the email fails', async () => {
    prisma.taxDocument.findUnique.mockResolvedValue({
      ...pendingDocument,
      status: DocumentStatus.DOCUMENT_GENERATED,
      folio: '16311',
      pdfUrl: 'https://files/boleta-16311.pdf',
    });
    email.sendTaxDocumentEmail.mockRejectedValue(new Error('SMTP caído'));

    await expect(service.deliverSiiDirectDocument('doc-1')).rejects.toThrow('SMTP caído');
    expect(prisma.taxDocument.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: DocumentStatus.DOCUMENT_FAILED }),
      }),
    );
  });
});
