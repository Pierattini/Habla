import bwipjs from 'bwip-js';
import PDFDocument from 'pdfkit';

const DOCUMENT_NAMES: Record<number, string> = {
  39: 'BOLETA ELECTRÓNICA',
  41: 'BOLETA EXENTA ELECTRÓNICA',
};

// Representación impresa de la boleta, armada desde el XML firmado que recibió el SII
// para que el PDF diga exactamente lo mismo. El timbre va como código PDF417.
export async function buildBoletaPdf(
  signedBoletaXml: string,
  resolution: { number: number; date: string },
  // Datos que solo van impresos (no forman parte del XML enviado al SII).
  extras: { sellerRut?: string | null; paymentMethod?: string | null } = {},
): Promise<Buffer> {
  const read = (tag: string) => unescapeXml(signedBoletaXml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1] ?? '');
  const ted = signedBoletaXml.match(/<TED version="1.0">[\s\S]*?<\/TED>/)?.[0];

  if (!ted) {
    throw new Error('La boleta no tiene timbre electrónico');
  }

  const dteCode = Number(read('TipoDTE'));
  const receiverRut = read('RUTRecep');
  // columns y eclevel son opciones propias de PDF417 que los tipos de bwip-js no listan.
  const barcode = await bwipjs.toBuffer({
    bcid: 'pdf417',
    text: ted,
    columns: 12,
    eclevel: 5,
    scale: 2,
  } as Parameters<typeof bwipjs.toBuffer>[0]);

  const pdf = new PDFDocument({ size: [226, 560], margin: 16 });
  const chunks: Buffer[] = [];
  pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => pdf.on('end', () => resolve(Buffer.concat(chunks))));

  pdf.font('Courier').fontSize(8);
  pdf.text(read('RznSocEmisor'));
  pdf.text(formatRut(read('RUTEmisor')));
  pdf.text(`Giro: ${read('GiroEmisor')}`);
  pdf.text(read('DirOrigen'));
  pdf.text(read('CmnaOrigen'));
  pdf.moveDown(0.5);
  pdf.font('Courier-Bold').text(`${DOCUMENT_NAMES[dteCode] ?? 'BOLETA ELECTRÓNICA'} NUMERO:`);
  pdf.text(formatNumber(Number(read('Folio'))));
  pdf.font('Courier');
  // Referencia del vendedor: RUT personal de la profesional que atendió.
  if (extras.sellerRut) {
    pdf.text(`REF. VENDEDOR: ${formatRutPlain(extras.sellerRut)}`);
  }
  pdf.text(`Fecha: ${read('FchEmis')}`);
  pdf.moveDown(0.8);

  if (receiverRut !== '66666666-6') {
    pdf.text('Datos del receptor:');
    pdf.text(`SEÑOR(ES): ${read('RznSocRecep')}`);
    pdf.text(`R.U.T: ${formatRut(receiverRut)}`);
    const receiverAddress = [read('DirRecep'), read('CmnaRecep')].filter(Boolean).join(', ');
    if (receiverAddress) {
      pdf.text(`Dirección: ${receiverAddress}`);
    }
    pdf.moveDown(0.8);
  }

  if (extras.paymentMethod) {
    pdf.text(`Medio de pago: ${extras.paymentMethod}`);
  }
  pdf.text(read('NmbItem'));
  pdf.text(`$ ${formatNumber(Number(read('MontoItem')))}`, { align: 'right' });

  // La boleta afecta desglosa neto e IVA; la exenta muestra solo el monto, como el formato del SII.
  if (read('IVA')) {
    pdf.moveDown(0.5);
    pdf.text(`Neto: $ ${formatNumber(Number(read('MntNeto')))}`, { align: 'right' });
    pdf.text(`IVA: $ ${formatNumber(Number(read('IVA')))}`, { align: 'right' });
    pdf.font('Courier-Bold').text(`TOTAL: $ ${formatNumber(Number(read('MntTotal')))}`, { align: 'right' });
    pdf.font('Courier');
  }

  pdf.moveDown(1);
  pdf.image(barcode, { fit: [194, 90], align: 'center' });
  pdf.moveDown(0.5);
  pdf.font('Courier').text('Timbre Electrónico SII', { align: 'center' });
  pdf.text(`Res. ${resolution.number} de ${resolution.date.slice(0, 4)}`, { align: 'center' });
  pdf.text('Verifique documento en sii.cl', { align: 'center' });
  pdf.end();

  return done;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-CL').format(value);
}

// 77761467-3 → 77.761.467-3
function formatRut(rut: string): string {
  const [number, dv] = rut.split('-');
  return number && dv ? `${formatNumber(Number(number))}-${dv}` : rut;
}

// 18390384-5 (sin puntos, como la referencia del vendedor y el RUT del receptor en el SII).
function formatRutPlain(rut: string): string {
  const clean = rut.replace(/[^\dkK]/g, '').toUpperCase();
  return clean.length > 1 ? `${clean.slice(0, -1)}-${clean.slice(-1)}` : rut;
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
