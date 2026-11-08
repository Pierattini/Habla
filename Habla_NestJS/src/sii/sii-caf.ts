import type { SiiEnvironment } from './sii-boleta-client';
import { normalizeRut } from './sii-format';

const forge = require('node-forge');

export type SiiCaf = {
  // Nodo <CAF>...</CAF> tal cual viene del SII: se copia sin cambios dentro del timbre.
  cafXml: string;
  privateKeyPem: string;
  rutEmisor: string;
  dteCode: number;
  startFolio: number;
  endFolio: number;
  // El SII marca cada CAF con IDK 100 (pruebas/certificación) o 300 (boletas reales).
  environment: SiiEnvironment;
};

// Lee el archivo de folios (CAF) que entrega el SII.
export function parseCaf(xml: string): SiiCaf {
  const cafXml = xml.match(/<CAF\b[\s\S]*?<\/CAF>/)?.[0];
  const privateKeyPem = readTag(xml, 'RSASK');

  if (!cafXml || !privateKeyPem) {
    throw new Error('El archivo de folios no tiene el formato CAF del SII');
  }

  const caf: SiiCaf = {
    cafXml,
    privateKeyPem,
    rutEmisor: normalizeRut(readTag(cafXml, 'RE') ?? ''),
    dteCode: Number(readTag(cafXml, 'TD')),
    startFolio: Number(readTag(cafXml, 'D')),
    endFolio: Number(readTag(cafXml, 'H')),
    environment: readTag(cafXml, 'IDK') === '100' ? 'CERTIFICATION' : 'PRODUCTION',
  };

  if (
    !Number.isInteger(caf.dteCode) ||
    !Number.isInteger(caf.startFolio) ||
    !Number.isInteger(caf.endFolio) ||
    caf.startFolio <= 0 ||
    caf.endFolio < caf.startFolio
  ) {
    throw new Error('El archivo de folios no tiene un rango válido');
  }

  try {
    forge.pki.privateKeyFromPem(caf.privateKeyPem);
  } catch {
    throw new Error('El archivo de folios no tiene una llave privada válida');
  }

  return caf;
}

function readTag(xml: string, tag: string): string | null {
  return xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() ?? null;
}
