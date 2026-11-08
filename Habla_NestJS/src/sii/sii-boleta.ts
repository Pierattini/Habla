import { SiiCaf } from './sii-caf';
import { SiiCertificateKeys } from './sii-certificate';
import { chileDate, chileTimestamp, escapeXml, normalizeRut, truncate } from './sii-format';
import { buildTed } from './sii-ted';
import { signSiiXml } from './sii-xml-signer';

export const BOLETA_AFECTA = 39;
export const BOLETA_EXENTA = 41;

// RUT genérico que el SII acepta en boletas cuando el paciente no entrega el suyo.
const GENERIC_RECEIVER_RUT = '66666666-6';
const SII_RUT = '60803000-K';
const XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';
const IVA_RATE = 0.19;
// 3 = boletas de venta y servicios (Formato Boletas Electrónicas SII v4.2, campo obligatorio).
const IND_SERVICIO_VENTAS_Y_SERVICIOS = 3;

export type BoletaInput = {
  dteCode: typeof BOLETA_AFECTA | typeof BOLETA_EXENTA;
  folio: number;
  issuedAt: Date;
  amount: number;
  itemName: string;
  emitter: { rut: string; name: string; activity: string; address: string; city: string };
  receiver: { rut?: string | null; name?: string | null; address?: string | null; city?: string | null };
};

export type EnvioBoletaInput = {
  emitterRut: string;
  // RUT personal de quien firma (dueña del certificado).
  senderRut: string;
  resolutionDate: string;
  resolutionNumber: number;
  signedAt: Date;
};

// Arma una boleta (DTE 39 o 41) con su timbre y la firma con el certificado de la profesional.
export function buildSignedBoleta(input: BoletaInput, caf: SiiCaf, keys: SiiCertificateKeys): string {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error('La boleta necesita un monto entero mayor a cero');
  }

  const emitterRut = normalizeRut(input.emitter.rut);

  if (emitterRut !== caf.rutEmisor) {
    throw new Error('Los folios son de otro RUT emisor');
  }

  const receiverRut = input.receiver.rut ? normalizeRut(input.receiver.rut) : GENERIC_RECEIVER_RUT;
  const receiverName = input.receiver.name?.trim() || 'Sin nombre';
  const itemName = truncate(input.itemName || 'Servicio profesional', 80);
  const id = `T${input.dteCode}F${input.folio}`;
  const ted = buildTed(
    {
      dteCode: input.dteCode,
      folio: input.folio,
      issuedAt: input.issuedAt,
      receiverRut,
      receiverName,
      amount: input.amount,
      firstItemName: itemName,
      stampedAt: input.issuedAt,
    },
    caf,
  );

  // La boleta declara los mismos namespaces que el sobre EnvioBOLETA: así su forma
  // canónica (y por lo tanto su firma) es igual sola o dentro del sobre.
  const xml = [
    `<DTE version="1.0" xmlns="http://www.sii.cl/SiiDte" xmlns:xsi="${XSI_NAMESPACE}">`,
    `<Documento ID="${id}">`,
    '<Encabezado>',
    '<IdDoc>',
    `<TipoDTE>${input.dteCode}</TipoDTE>`,
    `<Folio>${input.folio}</Folio>`,
    `<FchEmis>${chileDate(input.issuedAt)}</FchEmis>`,
    `<IndServicio>${IND_SERVICIO_VENTAS_Y_SERVICIOS}</IndServicio>`,
    '</IdDoc>',
    '<Emisor>',
    `<RUTEmisor>${emitterRut}</RUTEmisor>`,
    `<RznSocEmisor>${escapeXml(truncate(input.emitter.name, 100))}</RznSocEmisor>`,
    `<GiroEmisor>${escapeXml(truncate(input.emitter.activity, 80))}</GiroEmisor>`,
    `<DirOrigen>${escapeXml(truncate(input.emitter.address, 70))}</DirOrigen>`,
    `<CmnaOrigen>${escapeXml(truncate(input.emitter.city, 20))}</CmnaOrigen>`,
    '</Emisor>',
    '<Receptor>',
    `<RUTRecep>${receiverRut}</RUTRecep>`,
    `<RznSocRecep>${escapeXml(truncate(receiverName, 100))}</RznSocRecep>`,
    ...(input.receiver.address ? [`<DirRecep>${escapeXml(truncate(input.receiver.address, 70))}</DirRecep>`] : []),
    ...(input.receiver.city ? [`<CmnaRecep>${escapeXml(truncate(input.receiver.city, 20))}</CmnaRecep>`] : []),
    '</Receptor>',
    buildTotals(input.dteCode, input.amount),
    '</Encabezado>',
    '<Detalle>',
    '<NroLinDet>1</NroLinDet>',
    // MntExe es la suma de las líneas con IndExe = 1, así que en la exenta se marca la línea.
    ...(input.dteCode === BOLETA_EXENTA ? ['<IndExe>1</IndExe>'] : []),
    `<NmbItem>${escapeXml(itemName)}</NmbItem>`,
    '<QtyItem>1</QtyItem>',
    `<PrcItem>${input.amount}</PrcItem>`,
    `<MontoItem>${input.amount}</MontoItem>`,
    '</Detalle>',
    ted,
    `<TmstFirma>${chileTimestamp(input.issuedAt)}</TmstFirma>`,
    '</Documento>',
    '</DTE>',
    // El SII rechaza líneas de más de 4090 caracteres ("CHR-00002: Line too long"):
    // cada etiqueta va en su línea. Se hace antes de firmar, así la firma cubre este texto.
  ].join('\n');

  return signSiiXml(xml, id, keys);
}

// Sobre EnvioBOLETA con una o más boletas ya firmadas; el sobre también se firma.
export function buildSignedEnvioBoleta(
  signedBoletas: string[],
  input: EnvioBoletaInput,
  keys: SiiCertificateKeys,
): string {
  const counts = new Map<number, number>();

  for (const boleta of signedBoletas) {
    const dteCode = Number(boleta.match(/<TipoDTE>(\d+)<\/TipoDTE>/)?.[1]);
    counts.set(dteCode, (counts.get(dteCode) ?? 0) + 1);
  }

  const xml = [
    '<EnvioBOLETA version="1.0" xmlns="http://www.sii.cl/SiiDte" ',
    `xmlns:xsi="${XSI_NAMESPACE}" `,
    'xsi:schemaLocation="http://www.sii.cl/SiiDte EnvioBOLETA_v11.xsd">',
    '<SetDTE ID="SetDoc">',
    '<Caratula version="1.0">',
    `<RutEmisor>${normalizeRut(input.emitterRut)}</RutEmisor>`,
    `<RutEnvia>${normalizeRut(input.senderRut)}</RutEnvia>`,
    `<RutReceptor>${SII_RUT}</RutReceptor>`,
    `<FchResol>${input.resolutionDate}</FchResol>`,
    `<NroResol>${input.resolutionNumber}</NroResol>`,
    `<TmstFirmaEnv>${chileTimestamp(input.signedAt)}</TmstFirmaEnv>`,
    ...[...counts].map(
      ([dteCode, count]) => `<SubTotDTE><TpoDTE>${dteCode}</TpoDTE><NroDTE>${count}</NroDTE></SubTotDTE>`,
    ),
    '</Caratula>',
    ...signedBoletas.map((boleta) => boleta.replace(/^<\?xml[^>]*\?>/, '')),
    '</SetDTE>',
    '</EnvioBOLETA>',
  ].join('\n');

  return `<?xml version="1.0" encoding="ISO-8859-1"?>\n${signSiiXml(xml, 'SetDoc', keys)}`;
}

function buildTotals(dteCode: number, amount: number): string {
  if (dteCode === BOLETA_EXENTA) {
    return `<Totales><MntExe>${amount}</MntExe><MntTotal>${amount}</MntTotal></Totales>`;
  }

  // En boleta afecta el precio incluye IVA.
  const net = Math.round(amount / (1 + IVA_RATE));
  return `<Totales><MntNeto>${net}</MntNeto><IVA>${amount - net}</IVA><MntTotal>${amount}</MntTotal></Totales>`;
}
