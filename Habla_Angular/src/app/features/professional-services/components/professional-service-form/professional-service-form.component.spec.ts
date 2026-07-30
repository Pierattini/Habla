import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { ProfessionalServiceFormComponent } from './professional-service-form.component';

describe('ProfessionalServiceFormComponent', () => {
  it('keeps the draft and does not submit invalid data', () => {
    const component = new ProfessionalServiceFormComponent();
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);
    component.draft.name = 'A';
    component.draft.durationMinutes = 0;

    component.submit();

    expect(submitted).not.toHaveBeenCalled();
    expect(component.draft.name).toBe('A');
    expect(component.errors['name']).toBeTruthy();
    expect(component.errors['durationMinutes']).toBeTruthy();
  });

  it('normalizes consult services without a price', () => {
    const component = new ProfessionalServiceFormComponent();
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);
    component.draft.name = 'Evaluación inicial';
    component.draft.durationMinutes = 60;
    component.draft.priceType = 'CONSULT';
    component.draft.priceAmount = 45000;
    component.onPriceTypeChange();

    component.submit();

    expect(submitted).toHaveBeenCalledWith(
      expect.objectContaining({
        priceType: 'CONSULT',
        priceAmount: null,
      }),
    );
  });

  it('prevents duplicate submission while saving', () => {
    const component = new ProfessionalServiceFormComponent();
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);
    component.saving = true;
    component.draft.name = 'Evaluación inicial';

    component.submit();

    expect(submitted).not.toHaveBeenCalled();
  });
});
