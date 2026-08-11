import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({ selector:'app-available-slot-selector', standalone:true, imports:[CommonModule], templateUrl:'./available-slot-selector.component.html', styleUrl:'./available-slot-selector.component.scss' })
export class AvailableSlotSelectorComponent {
  @Input() slots: string[] = [];
  @Input() selected = '';
  @Input() loading = false;
  @Output() selectedChange = new EventEmitter<string>();
}

