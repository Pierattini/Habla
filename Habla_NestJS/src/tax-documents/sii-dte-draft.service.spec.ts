import { TaxDocumentType } from '@prisma/client';
import { SiiDteDraftService } from './sii-dte-draft.service';

describe('SiiDteDraftService', () => {
  const service = new SiiDteDraftService();
  const document = {
    id: 'doc-1',
    type: TaxDocumentType.BOLETA,
    amount: 45_000,
    currency: 'CLP',
    customerTaxId: '19243810-1',
    customerTaxName: 'Paciente',
    customerTaxAddress: 'Calle 1',
    customerTaxCity: 'Las Condes',
    professionalTaxId: '77761467-3',
    professionalTaxName: 'Centro SpA',
    professionalTaxAddress: 'Calle 2',
    professionalTaxCity: 'Maria Pinto',
    appointment: {
      id: 'appointment-1',
      date: new Date('2026-10-28T13:00:00.000Z'),
      serviceNameSnapshot: 'Sesión psicoterapia individual',
    },
  };

  it('builds an exempt boleta with the booked service name', () => {
    const draft = service.buildDraft({ ...document, taxExempt: true }, 10);

    expect(draft.dteCode).toBe(41);
    expect(draft.xml).toContain('<MntExe>45000</MntExe>');
    expect(draft.xml).toContain('<NmbItem>Sesión psicoterapia individual</NmbItem>');
  });

  it('builds a taxed boleta when the professional is not exempt', () => {
    const draft = service.buildDraft({ ...document, taxExempt: false }, 10);

    expect(draft.dteCode).toBe(39);
    expect(draft.xml).not.toContain('<MntExe>');
  });
});
