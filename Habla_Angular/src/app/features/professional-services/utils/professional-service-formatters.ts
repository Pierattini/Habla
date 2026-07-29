import {
  ProfessionalServicePriceType,
  PublicProfessionalService,
} from '../models/professional-service.models';

type PriceableService = Pick<PublicProfessionalService, 'priceType' | 'priceAmount' | 'currency'>;

export function formatProfessionalServicePrice(
  service: PriceableService,
  locale = 'es-CL',
): string {
  if (service.priceType === 'CONSULT') {
    return 'Consultar precio';
  }

  if (service.priceType === 'FREE') {
    return 'Gratuito';
  }

  const amount = service.priceAmount ?? 0;
  const currency = service.currency || 'CLP';
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === 'CLP' ? 0 : 2,
  }).format(amount);

  return service.priceType === 'FROM' ? `Desde ${formatted}` : formatted;
}

export function formatProfessionalServiceDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '';
  }

  const roundedMinutes = Math.round(minutes);
  const hours = Math.floor(roundedMinutes / 60);
  const remainingMinutes = roundedMinutes % 60;

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  if (remainingMinutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remainingMinutes} min`;
}

export function requiresProfessionalServicePrice(priceType: ProfessionalServicePriceType): boolean {
  return priceType === 'FIXED' || priceType === 'FROM';
}
