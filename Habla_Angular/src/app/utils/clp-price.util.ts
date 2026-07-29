export function formatClpPrice(value: unknown): string {
  const parsedValue =
    typeof value === 'string'
      ? Number(value.replace(/[^\d,-]/g, '').replace(',', '.'))
      : Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return '0';
  }

  // Existing profiles may store 45 (thousands of CLP) or 45000 (CLP).
  const amountInClp = parsedValue < 1000 ? parsedValue * 1000 : parsedValue;

  return new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 0,
  }).format(amountInClp);
}
