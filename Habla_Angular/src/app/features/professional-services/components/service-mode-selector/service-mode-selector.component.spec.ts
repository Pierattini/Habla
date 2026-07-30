import { describe, expect, it, vi } from 'vitest';
import { ServiceModeSelectorComponent } from './service-mode-selector.component';

describe('ServiceModeSelectorComponent', () => {
  it('requests a different mode', () => {
    const component = new ServiceModeSelectorComponent();
    const requested = vi.fn();
    component.modeRequested.subscribe(requested);

    component.requestMode('SERVICE_CATALOG');

    expect(requested).toHaveBeenCalledWith('SERVICE_CATALOG');
  });

  it('does not request the current mode or emit while saving', () => {
    const component = new ServiceModeSelectorComponent();
    const requested = vi.fn();
    component.modeRequested.subscribe(requested);
    component.requestMode('SINGLE_PRICE');
    component.saving = true;
    component.requestMode('SERVICE_CATALOG');

    expect(requested).not.toHaveBeenCalled();
  });
});
