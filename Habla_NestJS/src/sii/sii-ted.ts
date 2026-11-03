import { SiiCaf } from './sii-caf';
import { chileDate, chileTimestamp, escapeXml, normalizeRut, truncate } from './sii-format';

const forge = require('node-forge');

export type TedInput = {
  dteCode: number;
  folio: number;
  issuedAt: Date;
  receiverRut: string;
  receiverName: string;
  amount: number;
  firstItemName: string;
  stampedAt: Date;
};

// Timbre electrónico (TED): es lo que el SII imprime como código de barras en la boleta.
// El bloque DD se firma con la llave privada del CAF (RSA-SHA1) sobre su texto en ISO-8859-1.
export function buildTed(input: TedInput, caf: SiiCaf): string {
  if (caf.dteCode !== input.dteCode) {
    throw new Error(`Los folios son de tipo ${caf.dteCode} y la boleta es tipo ${input.dteCode}`);
  }

  if (input.folio < caf.startFolio || input.folio > caf.endFolio) {
    throw new Error(`El folio ${input.folio} no está dentro del archivo de folios`);
  }

  const dd = [
    '<DD>',
    `<RE>${caf.rutEmisor}</RE>`,
    `<TD>${input.dteCode}</TD>`,
    `<F>${input.folio}</F>`,
    `<FE>${chileDate(input.issuedAt)}</FE>`,
    `<RR>${normalizeRut(input.receiverRut)}</RR>`,
    `<RSR>${escapeXml(truncate(input.receiverName, 40))}</RSR>`,
    `<MNT>${input.amount}</MNT>`,
    `<IT1>${escapeXml(truncate(input.firstItemName, 40))}</IT1>`,
    caf.cafXml.replace(/>\s+</g, '><'),
    `<TSTED>${chileTimestamp(input.stampedAt)}</TSTED>`,
    '</DD>',
  ].join('');

  const key = forge.pki.privateKeyFromPem(caf.privateKeyPem);
  const md = forge.md.sha1.create();
  md.update(Buffer.from(dd, 'latin1').toString('binary'));
  const signature = forge.util.encode64(key.sign(md));

  return `<TED version="1.0">${dd}<FRMT algoritmo="SHA1withRSA">${signature}</FRMT></TED>`;
}
