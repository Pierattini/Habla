import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ProfessionalService } from '../../models/professional-service.models';
import { ProfessionalServiceDurationComponent } from '../professional-service-duration/professional-service-duration.component';
import { ProfessionalServicePriceComponent } from '../professional-service-price/professional-service-price.component';

@Component({
  selector: 'app-professional-service-card',
  standalone: true,
  imports: [CommonModule, ProfessionalServiceDurationComponent, ProfessionalServicePriceComponent],
  templateUrl: './professional-service-card.component.html',
  styleUrls: ['./professional-service-card.component.scss'],
})
export class ProfessionalServiceCardComponent {
  @Input({ required: true }) service!: ProfessionalService;
  @Input() first = false;
  @Input() last = false;
  @Input() busy = false;

  @Output() editRequested = new EventEmitter<ProfessionalService>();
  @Output() statusRequested = new EventEmitter<ProfessionalService>();
  @Output() visibilityRequested = new EventEmitter<ProfessionalService>();
  @Output() moveUpRequested = new EventEmitter<ProfessionalService>();
  @Output() moveDownRequested = new EventEmitter<ProfessionalService>();
  @Output() archiveRequested = new EventEmitter<ProfessionalService>();
}
