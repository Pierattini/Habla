import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeBlockFormComponent } from './time-block-form.component';

describe('TimeBlockFormComponent', () => {
  let fixture: ComponentFixture<TimeBlockFormComponent>;
  let component: TimeBlockFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TimeBlockFormComponent] }).compileComponents();
    fixture = TestBed.createComponent(TimeBlockFormComponent);
    component = fixture.componentInstance;
  });

  it.each([
    ['TIME_RANGE', { date: '2099-08-18', startTime: '09:00', endTime: '10:00' }],
    ['FULL_DAY', { date: '2099-08-18' }],
    ['DATE_RANGE', { startDate: '2099-08-18', endDate: '2099-08-20' }],
  ] as const)('creates a valid %s payload', (type, values) => {
    const emitted = vi.fn();
    component.createBlock.subscribe(emitted);
    component.type = type;
    Object.assign(component, values);
    component.reason = 'Motivo privado';
    component.submit();
    expect(emitted).toHaveBeenCalledWith(expect.objectContaining({ type, reason: 'Motivo privado' }));
  });

  it('rejects an invalid time range', () => {
    const emitted = vi.fn();
    component.createBlock.subscribe(emitted);
    component.type = 'TIME_RANGE';
    component.date = '2099-08-18';
    component.startTime = '10:00';
    component.endTime = '09:00';
    component.submit();
    expect(emitted).not.toHaveBeenCalled();
    expect(component.validationError).toContain('posterior');
  });

  it('prevents duplicate submission while saving', () => {
    const emitted = vi.fn();
    component.createBlock.subscribe(emitted);
    component.saving = true;
    component.submit();
    expect(emitted).not.toHaveBeenCalled();
  });
});
