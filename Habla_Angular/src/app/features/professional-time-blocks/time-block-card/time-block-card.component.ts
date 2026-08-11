import { CommonModule, DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ProfessionalTimeBlock } from '../professional-time-blocks.models';

@Component({
  selector: 'app-time-block-card',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './time-block-card.component.html',
  styleUrl: './time-block-card.component.scss',
})
export class TimeBlockCardComponent {
  @Input({ required: true }) block!: ProfessionalTimeBlock;
  @Input() deleting = false;
  @Output() unblock = new EventEmitter<ProfessionalTimeBlock>();

  get typeLabel(): string {
    return { TIME_RANGE: 'Rango horario', FULL_DAY: 'Día completo', DATE_RANGE: 'Rango de fechas' }[this.block.type];
  }

  get inclusiveEndDate(): Date {
    return new Date(new Date(this.block.endAt).getTime() - 1);
  }
}

