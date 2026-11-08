import { DocumentStatus, TaxDocumentType } from '@prisma/client';
import { createTestCaf, createTestCertificate } from '../sii/sii-test-fixtures';
import { SiiSendingProfile } from '../tax-provider/tax-provider.service';
import { SiiDirectIssuerService } from './sii-direct-issuer.service';

describe('SiiDirectIssuerService', () => {
  const { keys } = createTestCertificate();
  const caf = createTestCaf(41);
  const profile: SiiSendingProfile = {
    keys,
    emitterRut: '77.761.467-3',
    signerRut: '18.390.384-5',
    taxActivity: 'Centro terapéutico',
    resolutionNumber: 0,
    resolutionDate: '2026-11-01',
    environment: 'CERTIFICATION',
  };
  const document: any = {
    id: 'doc-1',
    appointmentId: 'appointment-1',
    type: TaxDocumentType.BOLETA,
    status: DocumentStatus.DOCUMENT_PENDING,
    taxExempt: true,
    amount: 45_000,
    folio: null,
    generatedAt: null,
    professionalTaxName: 'CRGARRIDO SPA',
    professionalTaxAddress: 'Tres Poniente 31',
    professionalTaxCity: 'María Pinto',
    customerTaxId: '19.243.810-1',
    customerTaxName: 'Paciente',
    appointment: {
      id: 'appointment-1',
      professionalId: 'professional-1',
      serviceNameSnapshot: 'Sesión psicoterapia individual',
    },
  };

  let prisma: any;
  let taxProvider: any;
  let client: any;
  let issuer: SiiDirectIssuerService;

  beforeEach(() => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ assignedFolio: 16311 }]),
      taxDocument: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma = {
      tx,
      $transaction: jest.fn((run: (client: typeof tx) => unknown) => run(tx)),
      taxDocument: {
        update: jest.fn(({ data }) => Promise.resolve({ ...document, ...data })),
        findUnique: jest.fn(),
      },
    };
    taxProvider = {
      getSiiSendingProfile: jest.fn().mockResolvedValue(profile),
      getCafXmlForFolio: jest.fn().mockResolvedValue(caf.xml),
    };
    client = {
      getToken: jest.fn().mockResolvedValue('TOK123'),
      upload: jest.fn().mockResolvedValue({ trackId: '1014', state: 'REC' }),
      getStatus: jest.fn(),
    };
    issuer = new SiiDirectIssuerService(prisma, taxProvider, client);
  });

  it('assigns a folio, signs the exempt boleta and keeps the SII track id', async () => {
    await issuer.issue(document, profile, 'professional-1');

    expect(prisma.tx.taxDocument.updateMany).toHaveBeenCalledWith({
      where: { id: 'doc-1', folio: null },
      data: { folio: '16311', dteCode: 41 },
    });
    const envelope = client.upload.mock.calls[0][0] as string;
    expect(envelope).toContain('<TipoDTE>41</TipoDTE>');
    expect(envelope).toContain('<Folio>16311</Folio>');
    expect(envelope).toContain('<NmbItem>Sesión psicoterapia individual</NmbItem>');
    expect(envelope).toContain('<RutEnvia>18390384-5</RutEnvia>');
    expect(prisma.taxDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ siiTrackId: '1014', dteCode: 41 }),
      }),
    );
  });

  it('reuses the folio already assigned when retrying', async () => {
    await issuer.issue({ ...document, folio: '16320' }, profile, 'professional-1');

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(client.upload.mock.calls[0][0]).toContain('<Folio>16320</Folio>');
  });

  it('explains when there are no folios left', async () => {
    prisma.tx.$queryRaw.mockResolvedValue([]);

    await expect(issuer.issue(document, profile, 'professional-1')).rejects.toThrow(/No quedan folios/);
    expect(client.upload).not.toHaveBeenCalled();
  });

  it('marks the boleta as generated when the SII accepts it', async () => {
    prisma.taxDocument.findUnique.mockResolvedValue({ ...document, folio: '16311', siiTrackId: '1014' });
    client.getStatus.mockResolvedValue({ state: 'EPR', outcome: 'ACCEPTED', detail: null, raw: {} });

    const result = await issuer.syncStatus('doc-1');

    expect(result?.outcome).toBe('ACCEPTED');
    expect(prisma.taxDocument.update.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ status: DocumentStatus.DOCUMENT_GENERATED, siiTrackId: '1014' }),
    );
  });

  it('marks it failed with the reason and frees the track id so it can be resent', async () => {
    prisma.taxDocument.findUnique.mockResolvedValue({ ...document, folio: '16311', siiTrackId: '1014' });
    client.getStatus.mockResolvedValue({
      state: 'RCH',
      outcome: 'REJECTED',
      detail: 'Firma inválida',
      raw: {},
    });

    await issuer.syncStatus('doc-1');

    expect(prisma.taxDocument.update.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        status: DocumentStatus.DOCUMENT_FAILED,
        siiStatusDetail: 'Firma inválida',
        siiTrackId: null,
      }),
    );
  });

  it('only updates the check time while the SII is still processing', async () => {
    prisma.taxDocument.findUnique.mockResolvedValue({ ...document, folio: '16311', siiTrackId: '1014' });
    client.getStatus.mockResolvedValue({ state: 'REC', outcome: 'PENDING', detail: null, raw: {} });

    await issuer.syncStatus('doc-1');

    expect(Object.keys(prisma.taxDocument.update.mock.calls[0][0].data)).toEqual([
      'siiStatus',
      'lastProviderSyncAt',
    ]);
  });
  it('refuses to send real folios to the SII test environment', async () => {
    taxProvider.getCafXmlForFolio.mockResolvedValue(caf.xml.replace('<IDK>100</IDK>', '<IDK>300</IDK>'));

    await expect(issuer.issue(document, profile, 'professional-1')).rejects.toThrow('Boletas reales');
    expect(client.upload).not.toHaveBeenCalled();
  });

  it('frees a boleta sent to another SII environment so it can be resent with its folio', async () => {
    prisma.taxDocument.findUnique.mockResolvedValue({
      ...document,
      folio: '21005',
      siiTrackId: '33917657',
      providerPayload: { siiDirect: { environment: 'CERTIFICATION' } },
    });
    taxProvider.getSiiSendingProfile.mockResolvedValue({ ...profile, environment: 'PRODUCTION' });

    const result = await issuer.syncStatus('doc-1');

    expect(client.getStatus).not.toHaveBeenCalled();
    expect(result?.outcome).toBe('REJECTED');
    expect(prisma.taxDocument.update.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ status: DocumentStatus.DOCUMENT_FAILED, siiTrackId: null }),
    );
  });
});
