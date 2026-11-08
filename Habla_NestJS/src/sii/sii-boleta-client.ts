import { Logger } from '@nestjs/common';
import { SiiCertificateKeys } from './sii-certificate';
import { normalizeRut } from './sii-format';
import { signSiiSeed } from './sii-xml-signer';

export type SiiEnvironment = 'CERTIFICATION' | 'PRODUCTION';

// API REST de boletas del SII. Las direcciones de envío son distintas a las de consulta.
const ENDPOINTS: Record<SiiEnvironment, { api: string; upload: string }> = {
  CERTIFICATION: { api: 'https://apicert.sii.cl', upload: 'https://pangal.sii.cl' },
  PRODUCTION: { api: 'https://api.sii.cl', upload: 'https://rahue.sii.cl' },
};
const PATH = '/recursos/v1/boleta.electronica';
const USER_AGENT = 'Mozilla/4.0 ( compatible; PROG 1.0; Windows NT)';

// Estados del envío según el SII.
const ACCEPTED_STATES = ['EPR', 'RLV', 'RPR'];
const REJECTED_STATES = ['RPT', 'RFR', 'VOF', 'RCT', 'RCH', 'RSC'];

export type SiiUploadResult = { trackId: string; state: string };

export type SiiStatusResult = {
  state: string;
  outcome: 'ACCEPTED' | 'REJECTED' | 'PENDING';
  detail: string | null;
  raw: unknown;
};

type Fetch = typeof fetch;

export class SiiBoletaClient {
  private readonly logger = new Logger(SiiBoletaClient.name);

  constructor(private readonly fetchFn: Fetch = fetch) {}

  async getToken(keys: SiiCertificateKeys, environment: SiiEnvironment): Promise<string> {
    const { api } = ENDPOINTS[environment];
    const seedXml = await this.request(`${api}${PATH}.semilla`, {
      headers: { Accept: 'application/xml' },
    });
    const seed = seedXml.match(/<SEMILLA>([^<]+)<\/SEMILLA>/)?.[1];

    if (!seed) {
      throw new Error('El SII no entregó la semilla de autenticación');
    }

    const body = signSiiSeed(`<getToken><item><Semilla>${seed}</Semilla></item></getToken>`, keys);
    const tokenXml = await this.request(`${api}${PATH}.token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml', Accept: 'application/xml' },
      body,
    });
    const token = tokenXml.match(/<TOKEN>([^<]+)<\/TOKEN>/)?.[1];

    if (!token) {
      const glosa = tokenXml.match(/<GLOSA>([^<]+)<\/GLOSA>/)?.[1];
      throw new Error(`El SII rechazó el certificado al iniciar sesión${glosa ? `: ${glosa}` : ''}`);
    }

    return token;
  }

  // Sube el sobre EnvioBOLETA (texto ISO-8859-1) y devuelve el número de seguimiento.
  async upload(
    envelopeXml: string,
    input: { emitterRut: string; senderRut: string; token: string; environment: SiiEnvironment },
  ): Promise<SiiUploadResult> {
    const [senderNumber, senderDv] = normalizeRut(input.senderRut).split('-');
    const [companyNumber, companyDv] = normalizeRut(input.emitterRut).split('-');
    const form = new FormData();
    form.append('rutSender', senderNumber);
    form.append('dvSender', senderDv);
    form.append('rutCompany', companyNumber);
    form.append('dvCompany', companyDv);
    form.append(
      'archivo',
      new Blob([Buffer.from(envelopeXml, 'latin1')], { type: 'application/xml' }),
      'EnvioBOLETA.xml',
    );

    const text = await this.request(`${ENDPOINTS[input.environment].upload}${PATH}.envio`, {
      method: 'POST',
      headers: this.authHeaders(input.token),
      body: form,
    });
    const json = this.parseJson(text);
    const trackId = json?.trackid;

    if (!trackId) {
      throw new Error(`El SII no recibió la boleta: ${json?.error || json?.mensaje || text.slice(0, 200)}`);
    }

    return { trackId: String(trackId), state: String(json.estado ?? 'REC') };
  }

  async getStatus(input: {
    emitterRut: string;
    trackId: string;
    token: string;
    environment: SiiEnvironment;
  }): Promise<SiiStatusResult> {
    const url = `${ENDPOINTS[input.environment].api}${PATH}.envio/${normalizeRut(input.emitterRut)}-${input.trackId}`;
    const json = this.parseJson(await this.request(url, { headers: this.authHeaders(input.token) }));
    const state = String(json?.estado ?? '');
    const rejectedCount = (json?.estadistica ?? []).reduce(
      (total: number, item: { rechazados?: number }) => total + (Number(item.rechazados) || 0),
      0,
    );
    const outcome = REJECTED_STATES.includes(state) || (ACCEPTED_STATES.includes(state) && rejectedCount > 0)
      ? 'REJECTED'
      : ACCEPTED_STATES.includes(state)
        ? 'ACCEPTED'
        : 'PENDING';

    const detail = outcome === 'REJECTED' ? this.describeRejection(json) : null;
    // Deja en el log la respuesta del SII (sin datos sensibles) para diagnosticar rechazos.
    this.logger.log(
      `SII estado envío ${input.trackId}: ${state || 'sin estado'} (${outcome})${detail ? ` - ${detail}` : ''}` +
        (outcome === 'REJECTED' ? ` ${JSON.stringify(json).slice(0, 1500)}` : ''),
    );

    return { state, outcome, detail, raw: json };
  }

  private describeRejection(json: any): string {
    const details = (json?.detalle_rep_rech ?? [])
      .flatMap((item: any) => item?.error ?? [item])
      .map((item: any) => item?.descripcion || item?.detalle || item?.glosa)
      .filter(Boolean);

    return details.length
      ? details.join('; ')
      : json?.glosa || json?.descripcion || `El SII rechazó la boleta (estado ${json?.estado})`;
  }

  private authHeaders(token: string) {
    return { Accept: 'application/json', Cookie: `TOKEN=${token}`, 'User-Agent': USER_AGENT };
  }

  // Cada llamada queda en el log (sin token ni contenido) para diagnosticar al SII.
  private async request(url: string, init: RequestInit = {}): Promise<string> {
    const startedAt = Date.now();
    const target = `${init.method ?? 'GET'} ${new URL(url).host}${new URL(url).pathname}`;
    let response: Response;

    try {
      response = await this.fetchFn(url, { ...init, signal: AbortSignal.timeout(30_000) });
    } catch (error) {
      const cause = (error as { cause?: { code?: string } })?.cause?.code;
      const name = (error as Error)?.name;
      this.logger.warn(`SII ${target} falló en ${Date.now() - startedAt}ms: ${name} ${cause ?? (error as Error)?.message}`);
      throw new Error(
        name === 'TimeoutError' || name === 'AbortError'
          ? 'El SII no respondió a tiempo. Inténtalo nuevamente en unos minutos.'
          : `No se pudo conectar con el SII (${cause ?? (error as Error)?.message})`,
      );
    }

    const text = await response.text();
    this.logger.log(`SII ${target} ${response.status} en ${Date.now() - startedAt}ms`);

    if (!response.ok) {
      throw new Error(`El SII respondió ${response.status}: ${text.slice(0, 200)}`);
    }

    return text;
  }

  private parseJson(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}
