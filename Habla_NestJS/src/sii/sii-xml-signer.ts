import { SignedXml } from 'xml-crypto';
import { SiiCertificateKeys } from './sii-certificate';

const forge = require('node-forge');

const RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
const SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

// Firma XMLDSig como la pide el SII: RSA-SHA1, C14N, referencia al nodo con ese ID
// y KeyInfo con KeyValue (módulo y exponente) más el certificado X509.
// La firma queda como hermana inmediata del nodo firmado.
export function signSiiXml(xml: string, id: string, keys: SiiCertificateKeys): string {
  const signer = new SignedXml({
    privateKey: keys.privateKeyPem,
    publicCert: keys.certificatePem,
    signatureAlgorithm: RSA_SHA1,
    canonicalizationAlgorithm: C14N,
    getKeyInfoContent: () => buildKeyInfo(keys.certificatePem),
  });
  const target = `//*[@ID='${id}']`;

  // El esquema del SII acepta un solo Transform. Como la firma queda fuera del nodo
  // firmado (es su hermana), no hace falta "enveloped-signature": basta C14N.
  signer.addReference({
    xpath: target,
    transforms: [C14N],
    digestAlgorithm: SHA1,
    uri: `#${id}`,
  });
  signer.computeSignature(xml, { location: { reference: target, action: 'after' } });

  return signer.getSignedXml();
}

// Firma de la semilla para pedir token: la referencia es el documento completo (URI vacía)
// y la firma va dentro de <getToken>.
export function signSiiSeed(xml: string, keys: SiiCertificateKeys): string {
  const signer = new SignedXml({
    privateKey: keys.privateKeyPem,
    publicCert: keys.certificatePem,
    signatureAlgorithm: RSA_SHA1,
    canonicalizationAlgorithm: C14N,
    getKeyInfoContent: () => buildKeyInfo(keys.certificatePem),
  });

  signer.addReference({
    xpath: '/*',
    transforms: [ENVELOPED, C14N],
    digestAlgorithm: SHA1,
    isEmptyUri: true,
  });
  signer.computeSignature(xml, { location: { reference: '/*', action: 'append' } });

  return signer.getSignedXml();
}

function buildKeyInfo(certificatePem: string): string {
  const certificate = forge.pki.certificateFromPem(certificatePem);
  const publicKey = certificate.publicKey;
  const toBase64 = (value: { toString(radix: number): string }) => {
    const hex = value.toString(16);
    return forge.util.encode64(forge.util.hexToBytes(hex.length % 2 ? `0${hex}` : hex));
  };
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();

  return [
    '<KeyValue><RSAKeyValue>',
    `<Modulus>${toBase64(publicKey.n)}</Modulus>`,
    `<Exponent>${toBase64(publicKey.e)}</Exponent>`,
    '</RSAKeyValue></KeyValue>',
    `<X509Data><X509Certificate>${forge.util.encode64(der)}</X509Certificate></X509Data>`,
  ].join('');
}
