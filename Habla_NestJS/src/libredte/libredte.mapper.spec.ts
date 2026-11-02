import { TaxDocumentType } from '@prisma/client';
import { LibreDteMapper } from './libredte.mapper';

describe('LibreDteMapper', () => {
  const mapper = new LibreDteMapper();

  it('emits an exempt boleta (41) by default', () => {
    expect(mapper.getDteCode(mapper.resolveKind(TaxDocumentType.BOLETA))).toBe(41);
    expect(mapper.getDteCode(mapper.resolveKind(null))).toBe(41);
  });

  it('emits taxed documents only when the professional is not exempt', () => {
    expect(mapper.resolveKind(TaxDocumentType.BOLETA, false)).toBe('BOLETA_AFECTA');
    expect(mapper.resolveKind(TaxDocumentType.FACTURA, false)).toBe('FACTURA_AFECTA');
    expect(mapper.resolveKind(TaxDocumentType.FACTURA, true)).toBe('FACTURA_EXENTA');
  });

  it('uses the given item name in the document detail', () => {
    const party = { rut: '1-9', name: 'X', address: 'Calle 1' };
    const payload = mapper.buildIssuePayload({
      documentId: 'doc-1',
      kind: 'BOLETA_EXENTA',
      amount: 45_000,
      currency: 'CLP',
      itemName: 'Sesión psicoterapia individual',
      customer: party,
      issuer: party,
      appointmentDate: new Date('2026-10-28T13:00:00.000Z'),
    });

    expect(payload.dte).toBe(41);
    expect(payload.detalle).toEqual([
      expect.objectContaining({ nombre: 'Sesión psicoterapia individual', total: 45_000 }),
    ]);
  });
});
