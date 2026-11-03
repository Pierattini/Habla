import { buildSignedBoleta } from './sii-boleta';
import { buildBoletaPdf } from './sii-boleta-pdf';
import { parseCaf } from './sii-caf';
import { createTestCaf, createTestCertificate } from './sii-test-fixtures';

describe('buildBoletaPdf', () => {
  const { keys } = createTestCertificate();
  const signed = buildSignedBoleta(
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

  it('renders a PDF with the PDF417 timbre', async () => {
    const pdf = await buildBoletaPdf(signed, { number: 80, date: '2014-08-22' });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    // Incluye la imagen del código de barras del timbre.
    expect(pdf.toString('latin1')).toContain('/Subtype /Image');
  });

  it('refuses a boleta without timbre', async () => {
    await expect(
      buildBoletaPdf(signed.replace(/<TED[\s\S]*<\/TED>/, ''), { number: 80, date: '2014-08-22' }),
    ).rejects.toThrow(/timbre/);
  });
});
