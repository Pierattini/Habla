import { SiiBoletaClient } from './sii-boleta-client';
import { createTestCertificate } from './sii-test-fixtures';

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: Record<string, string | { status: number; body: string }>) {
  const calls: Call[] = [];
  const fn = jest.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const key = Object.keys(responses).find((pattern) => url.includes(pattern));
    const response = key ? responses[key] : { status: 404, body: 'not found' };
    const { status, body } = typeof response === 'string' ? { status: 200, body: response } : response;
    return { ok: status < 400, status, text: async () => body } as Response;
  });

  return { fn: fn as unknown as typeof fetch, calls };
}

describe('SiiBoletaClient', () => {
  const { keys } = createTestCertificate();
  const seed = '<SII:RESPUESTA><SII:RESP_BODY><SEMILLA>012345</SEMILLA></SII:RESP_BODY></SII:RESPUESTA>';
  const token = '<SII:RESPUESTA><SII:RESP_BODY><TOKEN>TOK123</TOKEN></SII:RESP_BODY></SII:RESPUESTA>';

  it('signs the seed and returns the token from the certification environment', async () => {
    const { fn, calls } = fakeFetch({ 'semilla': seed, 'token': token });

    await expect(new SiiBoletaClient(fn).getToken(keys, 'CERTIFICATION')).resolves.toBe('TOK123');
    expect(calls[0].url).toBe('https://apicert.sii.cl/recursos/v1/boleta.electronica.semilla');
    expect(calls[1].url).toBe('https://apicert.sii.cl/recursos/v1/boleta.electronica.token');
    expect(String(calls[1].init.body)).toContain('<Semilla>012345</Semilla>');
    expect(String(calls[1].init.body)).toContain('<SignatureValue>');
  });

  it('explains when the SII rejects the certificate', async () => {
    const { fn } = fakeFetch({
      'semilla': seed,
      'token': '<RESPUESTA><RESP_HDR><ESTADO>10</ESTADO><GLOSA>Certificado no autorizado</GLOSA></RESP_HDR></RESPUESTA>',
    });

    await expect(new SiiBoletaClient(fn).getToken(keys, 'PRODUCTION')).rejects.toThrow(
      'Certificado no autorizado',
    );
  });

  it('uploads the envelope with the token cookie and returns the track id', async () => {
    const { fn, calls } = fakeFetch({ 'envio': JSON.stringify({ trackid: 1014, estado: 'REC' }) });

    const result = await new SiiBoletaClient(fn).upload('<?xml version="1.0"?><EnvioBOLETA/>', {
      emitterRut: '77.761.467-3',
      senderRut: '18.390.384-5',
      token: 'TOK123',
      environment: 'PRODUCTION',
    });

    expect(result).toEqual({ trackId: '1014', state: 'REC' });
    expect(calls[0].url).toBe('https://rahue.sii.cl/recursos/v1/boleta.electronica.envio');
    expect((calls[0].init.headers as Record<string, string>).Cookie).toBe('TOKEN=TOK123');
    const form = calls[0].init.body as FormData;
    expect(form.get('rutSender')).toBe('18390384');
    expect(form.get('dvSender')).toBe('5');
    expect(form.get('rutCompany')).toBe('77761467');
    expect(form.get('dvCompany')).toBe('3');
  });

  it.each([
    [{ estado: 'REC' }, 'PENDING'],
    [{ estado: 'EPR', estadistica: [{ tipo: 41, informados: 1, aceptados: 1, rechazados: 0 }] }, 'ACCEPTED'],
    [{ estado: 'RFR' }, 'REJECTED'],
  ])('reads the status %j as %s', async (body, outcome) => {
    const { fn, calls } = fakeFetch({ 'envio/': JSON.stringify(body) });

    const result = await new SiiBoletaClient(fn).getStatus({
      emitterRut: '77.761.467-3',
      trackId: '1014',
      token: 'TOK123',
      environment: 'CERTIFICATION',
    });

    expect(result.outcome).toBe(outcome);
    expect(calls[0].url).toBe('https://apicert.sii.cl/recursos/v1/boleta.electronica.envio/77761467-3-1014');
  });

  it('treats a processed envelope with rejected boletas as rejected and keeps the reason', async () => {
    const { fn } = fakeFetch({
      'envio/': JSON.stringify({
        estado: 'EPR',
        estadistica: [{ tipo: 41, informados: 1, aceptados: 0, rechazados: 1 }],
        detalle_rep_rech: [{ tipo: 41, folio: 16311, error: [{ descripcion: 'Folio fuera de rango' }] }],
      }),
    });

    const result = await new SiiBoletaClient(fn).getStatus({
      emitterRut: '77761467-3',
      trackId: '1014',
      token: 'TOK123',
      environment: 'CERTIFICATION',
    });

    expect(result).toEqual(expect.objectContaining({ outcome: 'REJECTED', detail: 'Folio fuera de rango' }));
  });
});
