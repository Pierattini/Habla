import { SignedXml } from 'xml-crypto';
import { buildSignedBoleta, buildSignedEnvioBoleta, BoletaInput } from './sii-boleta';
import { parseCaf } from './sii-caf';
import { extractCertificateKeys } from './sii-certificate';
import { chileDate, chileTimestamp, normalizeRut } from './sii-format';
import { buildTed } from './sii-ted';
import { createTestCaf, createTestCertificate } from './sii-test-fixtures';

const forge = require('node-forge');

function verifySignatures(xml: string, certificatePem: string): boolean[] {
  const signatures =
    xml.match(/<Signature xmlns="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#">[\s\S]*?<\/Signature>/g) ??
    [];

  return signatures.map((signature) => {
    const verifier = new SignedXml({ publicCert: certificatePem });
    verifier.loadSignature(signature);
    try {
      return verifier.checkSignature(xml);
    } catch {
      return false;
    }
  });
}

describe('SII boleta (fase A: timbre y firma)', () => {
  const certificate = createTestCertificate();
  const testCaf = createTestCaf();
  const caf = parseCaf(testCaf.xml);
  const boleta: BoletaInput = {
    dteCode: 41,
    folio: 16311,
    issuedAt: new Date('2026-10-28T15:00:00.000Z'),
    amount: 45_000,
    itemName: 'Sesión psicoterapia individual',
    emitter: {
      rut: '77.761.467-3',
      name: 'CRGARRIDO SPA',
      activity: 'Centro terapéutico',
      address: 'Tres Poniente 31Ñ',
      city: 'María Pinto',
    },
    receiver: { rut: '19.243.810-1', name: 'Paciente & Cía' },
  };

  it('formats RUT and Chile dates the way the SII expects', () => {
    expect(normalizeRut('77.761.467-3')).toBe('77761467-3');
    expect(normalizeRut('60803000-k')).toBe('60803000-K');
    expect(chileDate(new Date('2026-08-18T03:30:00.000Z'))).toBe('2026-08-17');
    expect(chileTimestamp(new Date('2026-10-28T15:00:00.000Z'))).toBe('2026-10-28T12:00:00');
  });

  it('reads the CAF file and rejects files without private key', () => {
    expect(caf).toEqual(
      expect.objectContaining({
        rutEmisor: '77761467-3',
        dteCode: 41,
        startFolio: 16311,
        endFolio: 16500,
      }),
    );
    expect(() => parseCaf(testCaf.xml.replace(/<RSASK>[\s\S]*<\/RSASK>/, ''))).toThrow();
  });

  it('stamps the TED with the CAF key over the DD block', () => {
    const ted = buildTed(
      {
        dteCode: 41,
        folio: 16311,
        issuedAt: boleta.issuedAt,
        receiverRut: '19243810-1',
        receiverName: 'Paciente',
        amount: 45_000,
        firstItemName: 'Sesión',
        stampedAt: boleta.issuedAt,
      },
      caf,
    );
    const dd = ted.match(/<DD>[\s\S]*<\/DD>/)![0];
    const signature = forge.util.decode64(ted.match(/<FRMT[^>]*>([^<]+)<\/FRMT>/)![1]);
    const md = forge.md.sha1.create();
    md.update(Buffer.from(dd, 'latin1').toString('binary'));

    expect(testCaf.publicKey.verify(md.digest().bytes(), signature)).toBe(true);
    expect(dd).toContain('<FE>2026-10-28</FE>');
  });

  it('refuses folios outside the CAF, another document type or another emitter', () => {
    expect(() => buildSignedBoleta({ ...boleta, folio: 16501 }, caf, certificate.keys)).toThrow(
      /folio/,
    );
    expect(() => buildSignedBoleta({ ...boleta, dteCode: 39 }, caf, certificate.keys)).toThrow(
      /tipo/,
    );
    expect(() =>
      buildSignedBoleta(
        { ...boleta, emitter: { ...boleta.emitter, rut: '11.111.111-1' } },
        caf,
        certificate.keys,
      ),
    ).toThrow(/RUT emisor/);
  });

  it('builds a signed exempt boleta that verifies and breaks if altered', () => {
    const signed = buildSignedBoleta(boleta, caf, certificate.keys);

    expect(signed).toContain('<TipoDTE>41</TipoDTE>');
    expect(signed).toContain('<MntExe>45000</MntExe>');
    expect(signed).toContain('<IndServicio>3</IndServicio>');
    expect(signed).toContain('<NroLinDet>1</NroLinDet>\n<IndExe>1</IndExe>');
    // El SII rechaza líneas de más de 4090 caracteres.
    expect(Math.max(...signed.split('\n').map((line) => line.length))).toBeLessThan(4090);
    expect(signed).toContain('<RznSocRecep>Paciente &amp; Cía</RznSocRecep>');
    expect(signed).toContain('<X509Certificate>');
    expect(signed).toContain('<Modulus>');
    expect(verifySignatures(signed, certificate.keys.certificatePem)).toEqual([true]);
    expect(
      verifySignatures(
        signed.replace('<MntTotal>45000', '<MntTotal>1'),
        certificate.keys.certificatePem,
      ),
    ).toEqual([false]);
  });

  it('uses the generic receiver RUT when the patient gives none', () => {
    const signed = buildSignedBoleta({ ...boleta, receiver: {} }, caf, certificate.keys);

    expect(signed).toContain('<RUTRecep>66666666-6</RUTRecep>');
  });

  it('splits net and IVA for a taxed boleta', () => {
    const taxedCaf = parseCaf(createTestCaf(39).xml);
    const signed = buildSignedBoleta({ ...boleta, dteCode: 39 }, taxedCaf, certificate.keys);

    expect(signed).toContain('<MntNeto>37815</MntNeto><IVA>7185</IVA><MntTotal>45000</MntTotal>');
  });

  it('wraps boletas in a signed EnvioBOLETA where every signature still verifies', () => {
    const first = buildSignedBoleta(boleta, caf, certificate.keys);
    const second = buildSignedBoleta({ ...boleta, folio: 16312 }, caf, certificate.keys);
    const envelope = buildSignedEnvioBoleta(
      [first, second],
      {
        emitterRut: '77.761.467-3',
        senderRut: '18.390.384-5',
        resolutionDate: '2014-08-22',
        resolutionNumber: 80,
        signedAt: boleta.issuedAt,
      },
      certificate.keys,
    );

    expect(envelope.startsWith('<?xml version="1.0" encoding="ISO-8859-1"?>')).toBe(true);
    expect(envelope).toContain('<SubTotDTE><TpoDTE>41</TpoDTE><NroDTE>2</NroDTE></SubTotDTE>');
    expect(verifySignatures(envelope, certificate.keys.certificatePem)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('reads the key pair from the professional .p12 file', () => {
    const keys = extractCertificateKeys(certificate.p12, 'clave-prueba');

    expect(keys.certificatePem).toBe(certificate.keys.certificatePem);
    expect(() => extractCertificateKeys(certificate.p12, 'otra-clave')).toThrow();
  });
});
