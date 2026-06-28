import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export type ReviewSubmitEvent = {
  rating: number;
  comment: string;
};

@Component({
  selector: 'app-appointment-review-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './appointment-review-modal.component.html',
  styleUrls: ['./appointment-review-modal.component.scss'],
})
export class AppointmentReviewModalComponent {
  @Input() submitting = false;
  @Output() close = new EventEmitter<void>();
  @Output() submitReview = new EventEmitter<ReviewSubmitEvent>();

  rating = 5;
  comment = '';

  setRating(value: number): void {
    this.rating = value;
  }

  submit(): void {
    if (this.submitting || this.comment.trim().length > 500) {
      return;
    }

    this.submitReview.emit({
      rating: this.rating,
      comment: this.comment.trim(),
    });
  }
}
