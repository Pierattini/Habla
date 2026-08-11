import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomerSearchResult } from '../manual-appointments.models';

@Component({ selector:'app-customer-search', standalone:true, imports:[CommonModule,FormsModule], templateUrl:'./customer-search.component.html', styleUrl:'./customer-search.component.scss' })
export class CustomerSearchComponent {
  @Input() customers: CustomerSearchResult[] = [];
  @Input() searching = false;
  @Input() selected: CustomerSearchResult | null = null;
  @Output() search = new EventEmitter<string>();
  @Output() selectCustomer = new EventEmitter<CustomerSearchResult>();
  query = '';
  searchNow(): void { this.search.emit(this.query); }
}

