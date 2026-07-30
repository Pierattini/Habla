import { Component, Input } from '@angular/core';
import { formatProfessionalServiceDuration } from '../../utils/professional-service-formatters';

@Component({
  selector: 'app-professional-service-duration',
  standalone: true,
  template: `<span class="service-duration">{{ label }}</span>`,
  styles: [
    `
      .service-duration {
        color: var(--app-muted);
        font-weight: 800;
      }
    `,
  ],
})
export class ProfessionalServiceDurationComponent {
  @Input({ required: true }) minutes = 0;

  get label(): string {
    return formatProfessionalServiceDuration(this.minutes);
  }
}
