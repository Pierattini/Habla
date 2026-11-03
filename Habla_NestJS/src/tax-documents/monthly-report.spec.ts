import { buildMonthlyReportCsv, isInChileMonth, monthWindow } from './monthly-report';

describe('monthly report', () => {
  const paid = {
    date: new Date('2026-10-28T15:00:00.000Z'),
    paidAt: new Date('2026-10-27T20:00:00.000Z'),
    guestCustomerName: null,
    serviceNameSnapshot: 'Sesión psicoterapia individual',
    servicePriceAmountSnapshot: 45_000,
    customer: {
      name: 'Florencia',
      email: 'flor@correo.cl',
      taxId: '19.243.810-1',
      taxName: 'Florencia Sanz; Vergara',
      taxAddress: 'Escandinavia 372',
      taxCity: 'Las Condes',
    },
    taxDocument: null,
  };

  it('lists paid sessions with what is needed to issue a boleta by hand', () => {
    const csv = buildMonthlyReportCsv([paid]);
    const [header, row] = csv.replace('﻿', '').split('\r\n');

    expect(csv.startsWith('﻿')).toBe(true);
    expect(header.split(';')).toContain('Folio');
    expect(row).toBe(
      '2026-10-27;2026-10-28;"Florencia Sanz; Vergara";19.243.810-1;flor@correo.cl;' +
        'Escandinavia 372, Las Condes;Sesión psicoterapia individual;45000;;;;Sin documento',
    );
  });

  it('adds folio, type and status of boletas issued through Habla', () => {
    const csv = buildMonthlyReportCsv([
      {
        ...paid,
        taxDocument: {
          amount: 45_000,
          dteCode: 41,
          folio: '16311',
          status: 'DOCUMENT_SENT',
          generatedAt: new Date('2026-10-27T20:05:00.000Z'),
          siiStatus: 'EPR',
        },
      },
    ]);

    expect(csv).toContain(';45000;Boleta exenta (41);16311;2026-10-27;Enviada al paciente');
  });

  it('does not let Excel run a patient name as a formula', () => {
    const csv = buildMonthlyReportCsv([
      { ...paid, customer: { ...paid.customer, taxName: '=HYPERLINK("x")' } },
    ]);

    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('uses the Chile calendar month', () => {
    // 1 de noviembre 02:00 UTC es todavía 31 de octubre en Chile.
    expect(isInChileMonth(new Date('2026-11-01T02:00:00.000Z'), '2026-10')).toBe(true);
    expect(isInChileMonth(new Date('2026-11-01T02:00:00.000Z'), '2026-11')).toBe(false);
    const { from, to } = monthWindow('2026-10');
    expect(from.toISOString()).toBe('2026-09-30T00:00:00.000Z');
    expect(to.toISOString()).toBe('2026-11-02T00:00:00.000Z');
  });
});
