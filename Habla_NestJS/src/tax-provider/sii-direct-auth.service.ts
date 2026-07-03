import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignedXml } from 'xml-crypto';

const forge = require('node-forge');

type SiiEnvironment = 'CERTIFICATION' | 'PRODUCTION';

type SiiAuthInput = {
  certificateBuffer: Buffer;
  passphrase: string;
  environment: string | null;
};

type SiiCertificateKeys = {
  privateKeyPem: string;
  certificatePem: string;
};

@Injectable()
export class SiiDirectAuthService {
  constructor(private readonly config: ConfigService) {}

  async requestToken(input: SiiAuthInput) {
    const environment = this.normalizeEnvironment(input.environment);
    const endpoints = this.getEndpoints(environment);
    const keys = this.extractCertificateKeys(
      input.certificateBuffer,
      input.passphrase,
    );
    const seed = await this.requestSeed(endpoints.seedUrl);
    const signedSeed = this.signSeed(seed, keys);
    const token = await this.requestTokenFromSeed(endpoints.tokenUrl, signedSeed);

    return {
      environment,
      tokenPreview: this.maskToken(token),
      requestedAt: new Date(),
    };
  }

  private async requestSeed(seedUrl: string): Promise<string> {
    const response = await this.postSoap(
      seedUrl,
      [
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:def="http://DefaultNamespace">',
        '<soapenv:Header/>',
        '<soapenv:Body>',
        '<def:getSeed/>',
        '</soapenv:Body>',
        '</soapenv:Envelope>',
      ].join(''),
    );

    const seed = this.extractXmlValue(response, 'SEMILLA');

    if (!seed) {
      throw new BadRequestException('SII no devolvio semilla de autenticacion');
    }

    return seed;
  }

  private async requestTokenFromSeed(
    tokenUrl: string,
    signedSeed: string,
  ): Promise<string> {
    const response = await this.postSoap(
      tokenUrl,
      [
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:def="http://DefaultNamespace">',
        '<soapenv:Header/>',
        '<soapenv:Body>',
        '<def:getToken>',
        `<def:pszXml><![CDATA[${signedSeed}]]></def:pszXml>`,
        '</def:getToken>',
        '</soapenv:Body>',
        '</soapenv:Envelope>',
      ].join(''),
    );

    const token = this.extractXmlValue(response, 'TOKEN');

    if (!token) {
      throw new BadRequestException('SII no devolvio token de autenticacion');
    }

    return token;
  }

  private async postSoap(url: string, body: string): Promise<string> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: '',
      },
      body,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new BadRequestException(
        `SII respondio ${response.status}: ${text.slice(0, 240)}`,
      );
    }

    return text;
  }

  private signSeed(seed: string, keys: SiiCertificateKeys): string {
    const xml = [
      '<getToken Id="SIISeed">',
      '<item>',
      `<Semilla>${this.escapeXml(seed)}</Semilla>`,
      '</item>',
      '</getToken>',
    ].join('');

    const signer = new SignedXml({
      privateKey: keys.privateKeyPem,
      publicCert: keys.certificatePem,
      signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
      canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    });

    signer.addReference({
      xpath: "//*[@Id='SIISeed']",
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
      uri: '#SIISeed',
    });

    signer.computeSignature(xml, {
      location: {
        reference: "//*[@Id='SIISeed']",
        action: 'append',
      },
    });

    return signer.getSignedXml();
  }

  private extractCertificateKeys(
    certificateBuffer: Buffer,
    passphrase: string,
  ): SiiCertificateKeys {
    try {
      const p12Asn1 = forge.asn1.fromDer(
        certificateBuffer.toString('binary'),
        false,
      );
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);
      const keyBags =
        p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
          forge.pki.oids.pkcs8ShroudedKeyBag
        ] ||
        p12.getBags({ bagType: forge.pki.oids.keyBag })[
          forge.pki.oids.keyBag
        ] ||
        [];
      const certBags =
        p12.getBags({ bagType: forge.pki.oids.certBag })[
          forge.pki.oids.certBag
        ] || [];
      const privateKey = keyBags[0]?.key;
      const certificate = certBags[0]?.cert;

      if (!privateKey || !certificate) {
        throw new Error('missing key or certificate');
      }

      return {
        privateKeyPem: forge.pki.privateKeyToPem(privateKey),
        certificatePem: forge.pki.certificateToPem(certificate),
      };
    } catch {
      throw new BadRequestException(
        'No pudimos leer la llave privada del certificado digital.',
      );
    }
  }

  private getEndpoints(environment: SiiEnvironment) {
    if (environment === 'CERTIFICATION') {
      return {
        seedUrl:
          this.config.get<string>('SII_CERTIFICATION_SEED_URL') ||
          'https://maullin.sii.cl/DTEWS/CrSeed.jws',
        tokenUrl:
          this.config.get<string>('SII_CERTIFICATION_TOKEN_URL') ||
          'https://maullin.sii.cl/DTEWS/GetTokenFromSeed.jws',
      };
    }

    return {
      seedUrl:
        this.config.get<string>('SII_PRODUCTION_SEED_URL') ||
        'https://palena.sii.cl/DTEWS/CrSeed.jws',
      tokenUrl:
        this.config.get<string>('SII_PRODUCTION_TOKEN_URL') ||
        'https://palena.sii.cl/DTEWS/GetTokenFromSeed.jws',
    };
  }

  private extractXmlValue(xml: string, tagName: string): string | null {
    const pattern = new RegExp(
      `<(?:\\w+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tagName}>`,
      'i',
    );
    const match = xml.match(pattern);
    return match?.[1] ? this.unescapeXml(match[1].trim()) : null;
  }

  private normalizeEnvironment(value: string | null): SiiEnvironment {
    return value === 'CERTIFICATION' ? 'CERTIFICATION' : 'PRODUCTION';
  }

  private maskToken(token: string): string {
    if (token.length <= 8) {
      return '********';
    }

    return `${token.slice(0, 4)}...${token.slice(-4)}`;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private unescapeXml(value: string): string {
    return value
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
  }
}
