import { describe, expect, it } from 'vitest';
import {
  formatProfessionalServiceDuration,
  formatProfessionalServicePrice,
  requiresProfessionalServicePrice,
} from './professional-service-formatters';

describe('professional service formatters', () => {
  it('formats fixed and from prices', () => {
    expect(
      formatProfessionalServicePrice({
        priceType: 'FIXED',
        priceAmount: 45000,
        currency: 'CLP',
      }),
    ).toContain('45.000');

    expect(
      formatProfessionalServicePrice(
        {
          priceType: 'FROM',
          priceAmount: 30,
          currency: 'EUR',
        },
        'es-ES',
      ),
    ).toContain('Desde');
  });

  it('formats consult and free prices without an amount', () => {
    expect(
      formatProfessionalServicePrice({
        priceType: 'CONSULT',
        priceAmount: null,
        currency: 'CLP',
      }),
    ).toBe('Consultar precio');
    expect(
      formatProfessionalServicePrice({
        priceType: 'FREE',
        priceAmount: 0,
        currency: 'CLP',
      }),
    ).toBe('Gratuito');
  });

  it('formats durations consistently', () => {
    expect(formatProfessionalServiceDuration(45)).toBe('45 min');
    expect(formatProfessionalServiceDuration(60)).toBe('1 h');
    expect(formatProfessionalServiceDuration(90)).toBe('1 h 30 min');
  });

  it('identifies price types that require an amount', () => {
    expect(requiresProfessionalServicePrice('FIXED')).toBe(true);
    expect(requiresProfessionalServicePrice('FROM')).toBe(true);
    expect(requiresProfessionalServicePrice('CONSULT')).toBe(false);
    expect(requiresProfessionalServicePrice('FREE')).toBe(false);
  });
});
