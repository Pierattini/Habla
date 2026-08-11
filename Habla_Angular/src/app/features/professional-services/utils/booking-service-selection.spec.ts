import { describe, expect, it } from 'vitest';
import {
  buildServiceAvailabilityParams,
  withSelectedProfessionalService,
} from './booking-service-selection';

describe('booking service selection', () => {
  it('keeps SINGLE_PRICE requests unchanged', () => {
    expect(buildServiceAvailabilityParams('professional-1', '2026-08-18', null)).toEqual({
      professionalId: 'professional-1',
      date: '2026-08-18',
    });
    expect(withSelectedProfessionalService({ professionalId: 'professional-1' }, null)).toEqual({
      professionalId: 'professional-1',
    });
  });

  it('preserves the selected service in availability and booking requests', () => {
    expect(
      buildServiceAvailabilityParams('professional-1', '2026-08-18', 'service-1'),
    ).toEqual({
      professionalId: 'professional-1',
      date: '2026-08-18',
      serviceId: 'service-1',
    });
    expect(
      withSelectedProfessionalService({ professionalId: 'professional-1' }, 'service-1'),
    ).toEqual({ professionalId: 'professional-1', serviceId: 'service-1' });
  });
});
