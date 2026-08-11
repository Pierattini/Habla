import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { PublicProfessionalService } from '../../models/professional-service.models';
import { ProfessionalServiceDurationComponent } from '../professional-service-duration/professional-service-duration.component';
import { ProfessionalServicePriceComponent } from '../professional-service-price/professional-service-price.component';

@Component({
  selector: 'app-public-services-accordion',
  standalone: true,
  imports: [
    CommonModule,
    ProfessionalServiceDurationComponent,
    ProfessionalServicePriceComponent,
  ],
  templateUrl: './public-services-accordion.component.html',
  styleUrls: ['./public-services-accordion.component.scss'],
})
export class PublicServicesAccordionComponent {
  @Input({ required: true }) services: PublicProfessionalService[] = [];
  @Input() selectedServiceId: string | null = null;
  @Output() readonly serviceSelected = new EventEmitter<PublicProfessionalService>();

  readonly expandedServiceId = signal<string | null>(null);

  toggle(serviceId: string): void {
    this.expandedServiceId.update((current) => (current === serviceId ? null : serviceId));
  }
}
