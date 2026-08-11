import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CreateProfessionalTimeBlock } from '../professional-time-blocks.models';
import { ProfessionalTimeBlocksStore } from '../professional-time-blocks.store';
import { TimeBlockFormComponent } from '../time-block-form/time-block-form.component';
import { TimeBlockListComponent } from '../time-block-list/time-block-list.component';
import { ManualAppointmentFormComponent } from '../../manual-appointments/manual-appointment-form/manual-appointment-form.component';

@Component({
  selector: 'app-professional-agenda-manager',
  standalone: true,
  imports: [CommonModule, TimeBlockFormComponent, TimeBlockListComponent, ManualAppointmentFormComponent],
  templateUrl: './professional-agenda-manager.component.html',
  styleUrl: './professional-agenda-manager.component.scss',
})
export class ProfessionalAgendaManagerComponent implements OnInit {
  readonly store = inject(ProfessionalTimeBlocksStore);
  @ViewChild(TimeBlockFormComponent) private form?: TimeBlockFormComponent;
  showManualAppointment = false;

  ngOnInit(): void {
    void this.store.loadBlocks();
  }

  async create(payload: CreateProfessionalTimeBlock): Promise<void> {
    if (await this.store.createBlock(payload)) this.form?.reset();
  }
}
