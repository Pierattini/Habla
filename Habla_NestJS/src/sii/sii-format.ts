// Utilidades de formato comunes a los XML que se envían al SII.

const SII_TIMEZONE = 'America/Santiago';

export function escapeXml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// El SII espera el RUT sin puntos, con guion y la K en mayúscula: 77761467-3.
export function normalizeRut(value: string): string {
  const clean = value.replace(/[.\s]/g, '').toUpperCase();
  const match = clean.match(/^(\d{1,8})-?([\dK])$/);

  if (!match) {
    throw new Error(`RUT inválido: ${value}`);
  }

  return `${Number(match[1])}-${match[2]}`;
}

// Recorta a un largo máximo sin cortar un carácter por la mitad.
export function truncate(value: string, maxLength: number): string {
  return Array.from(value.trim()).slice(0, maxLength).join('');
}

function chileParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SII_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}:${get('second')}`,
  };
}

// Fecha en hora de Chile: YYYY-MM-DD.
export function chileDate(date: Date): string {
  return chileParts(date).date;
}

// Fecha y hora en hora de Chile: YYYY-MM-DDTHH:MM:SS.
export function chileTimestamp(date: Date): string {
  const parts = chileParts(date);
  return `${parts.date}T${parts.time}`;
}
