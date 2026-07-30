import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ProfessionalServiceMode } from '../../models/professional-service.models';

@Component({
  selector: 'app-service-mode-selector',
  standalone: true,
  templateUrl: './service-mode-selector.component.html',
  styleUrls: ['./service-mode-selector.component.scss'],
})
export class ServiceModeSelectorComponent {
  @Input({ required: true }) mode: ProfessionalServiceMode = 'SINGLE_PRICE';
  @Input() saving = false;
  @Output() modeRequested = new EventEmitter<ProfessionalServiceMode>();

  requestMode(mode: ProfessionalServiceMode): void {
    if (!this.saving && mode !== this.mode) {
      this.modeRequested.emit(mode);
    }
  }
}
