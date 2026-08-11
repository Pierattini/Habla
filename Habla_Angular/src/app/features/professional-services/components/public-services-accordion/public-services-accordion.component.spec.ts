import { describe, expect, it, vi } from 'vitest';
import { PublicProfessionalService } from '../../models/professional-service.models';
import { PublicServicesAccordionComponent } from './public-services-accordion.component';

describe('PublicServicesAccordionComponent', () => {
  const service: PublicProfessionalService = {
    id: 'service-1',
    name: 'Evaluación extendida',
    description: 'Evaluación de noventa minutos.',
    durationMinutes: 90,
    priceType: 'FIXED',
    priceAmount: 60_000,
    currency: 'CLP',
    sortOrder: 0,
    icon: null,
    imageUrl: null,
    color: null,
    allowBooking: true,
  };

  it('expands and collapses a service without changing selection', () => {
    const component = new PublicServicesAccordionComponent();
    component.services = [service];

    component.toggle(service.id);
    expect(component.expandedServiceId()).toBe(service.id);
    component.toggle(service.id);
    expect(component.expandedServiceId()).toBeNull();
  });

  it('emits the selected service', () => {
    const component = new PublicServicesAccordionComponent();
    const listener = vi.fn();
    component.serviceSelected.subscribe(listener);

    component.serviceSelected.emit(service);

    expect(listener).toHaveBeenCalledWith(service);
  });
});
