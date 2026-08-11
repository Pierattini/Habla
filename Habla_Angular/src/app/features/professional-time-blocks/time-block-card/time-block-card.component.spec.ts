import { TestBed } from '@angular/core/testing';
import { TimeBlockCardComponent } from './time-block-card.component';

describe('TimeBlockCardComponent', () => {
  it('shows the private reason in the professional block card', async () => {
    await TestBed.configureTestingModule({ imports: [TimeBlockCardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TimeBlockCardComponent);
    fixture.componentInstance.block = {
      id: 'block-1', professionalId: 'professional-1', type: 'FULL_DAY',
      startAt: '2099-08-18T04:00:00.000Z', endAt: '2099-08-19T04:00:00.000Z',
      reason: 'Motivo que solo ve el profesional', createdAt: '', updatedAt: '',
    };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Motivo que solo ve el profesional');
  });
});
