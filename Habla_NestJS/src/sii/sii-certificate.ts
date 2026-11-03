const forge = require('node-forge');

export type SiiCertificateKeys = {
  privateKeyPem: string;
  certificatePem: string;
};

// Extrae llave privada y certificado del archivo .pfx/.p12 de la profesional.
export function extractCertificateKeys(
  certificateBuffer: Buffer,
  passphrase: string,
): SiiCertificateKeys {
  const p12Asn1 = forge.asn1.fromDer(certificateBuffer.toString('binary'), false);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);
  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] ||
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ||
    [];
  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const privateKey = keyBags[0]?.key;
  const certificate = certBags[0]?.cert;

  if (!privateKey || !certificate) {
    throw new Error('missing key or certificate');
  }

  return {
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    certificatePem: forge.pki.certificateToPem(certificate),
  };
}
