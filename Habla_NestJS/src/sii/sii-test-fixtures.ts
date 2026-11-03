// Certificado y archivo de folios de prueba generados en el momento: nunca datos reales.
// Solo se usan en tests.
import { SiiCertificateKeys } from './sii-certificate';

const forge = require('node-forge');

export function createTestCertificate(): { keys: SiiCertificateKeys; p12: Buffer } {
  const pair = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = pair.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2027-01-01T00:00:00Z');
  cert.setSubject([{ name: 'commonName', value: 'Profesional de prueba' }]);
  cert.setIssuer([{ name: 'commonName', value: 'Profesional de prueba' }]);
  cert.sign(pair.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(pair.privateKey, [cert], 'clave-prueba', {
    algorithm: '3des',
  });

  return {
    keys: {
      privateKeyPem: forge.pki.privateKeyToPem(pair.privateKey),
      certificatePem: forge.pki.certificateToPem(cert),
    },
    p12: Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'),
  };
}

export function createTestCaf(dteCode = 41, rutEmisor = '77761467-3') {
  const pair = forge.pki.rsa.generateKeyPair(512);
  const xml = `<?xml version="1.0"?>
<AUTORIZACION>
  <CAF version="1.0">
    <DA>
      <RE>${rutEmisor}</RE>
      <RS>CRGARRIDO SPA</RS>
      <TD>${dteCode}</TD>
      <RNG><D>16311</D><H>16500</H></RNG>
      <FA>2026-11-01</FA>
      <RSAPK><M>AAA=</M><E>Aw==</E></RSAPK>
      <IDK>100</IDK>
    </DA>
    <FRMA algoritmo="SHA1withRSA">AAA=</FRMA>
  </CAF>
  <RSASK>${forge.pki.privateKeyToPem(pair.privateKey)}</RSASK>
  <RSAPUBK>${forge.pki.publicKeyToPem(pair.publicKey)}</RSAPUBK>
</AUTORIZACION>`;

  return { xml, publicKey: pair.publicKey };
}
