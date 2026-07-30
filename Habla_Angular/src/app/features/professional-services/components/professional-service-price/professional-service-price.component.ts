import { Component, Input } from '@angular/core';
import { PublicProfessionalService } from '../../models/professional-service.models';
import { formatProfessionalServicePrice } from '../../utils/professional-service-formatters';

@Component({
  selector: 'app-professional-service-price',
  standalone: true,
  template: `<span class="service-price">{{ label }}</span>`,
  styles: [
    `
      .service-price {
        color: var(--app-primary);
        font-weight: 900;
      }
    `,
  ],
})
export class ProfessionalServicePriceComponent {
  @Input({ required: true })
  service!: Pick<PublicProfessionalService, 'priceType' | 'priceAmount' | 'currency'>;

  get label(): string {
    return formatProfessionalServicePrice(this.service);
  }
}
