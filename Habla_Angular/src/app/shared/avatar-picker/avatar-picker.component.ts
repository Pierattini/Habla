import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-avatar-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './avatar-picker.component.html',
  styleUrls: ['./avatar-picker.component.scss'],
})
export class AvatarPickerComponent {
  @Input() image = '';
  @Input() title = 'Elegir imagen';
  @Input() canClear = true;

  @Output() fileSelected = new EventEmitter<Event>();
  @Output() avatarSelected = new EventEmitter<string>();
  @Output() clearImage = new EventEmitter<void>();

  isOpen = false;

  readonly defaultAvatars = [
    this.buildDefaultAvatar('#a855f7', '#ec4899'),
    this.buildDefaultAvatar('#7c3aed', '#38bdf8'),
    this.buildDefaultAvatar('#14b8a6', '#a855f7'),
    this.buildDefaultAvatar('#f97316', '#facc15'),
    this.buildDefaultAvatar('#2563eb', '#22c55e'),
  ];

  get previewImage(): string {
    return this.image || this.defaultAvatars[0];
  }

  open() {
    this.isOpen = true;
  }

  close() {
    this.isOpen = false;
  }

  selectAvatar(avatar: string) {
    this.avatarSelected.emit(avatar);
    this.close();
  }

  selectFile(event: Event) {
    this.fileSelected.emit(event);
    this.close();
  }

  clear() {
    this.clearImage.emit();
    this.close();
  }

  private buildDefaultAvatar(primary: string, secondary: string): string {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
        <defs>
          <linearGradient id="g" x1="20" y1="20" x2="140" y2="140" gradientUnits="userSpaceOnUse">
            <stop stop-color="${primary}" />
            <stop offset="1" stop-color="${secondary}" />
          </linearGradient>
        </defs>
        <rect width="160" height="160" rx="46" fill="#fff" />
        <circle cx="80" cy="66" r="26" fill="url(#g)" />
        <path d="M34 136c7-28 25-43 46-43s39 15 46 43" fill="url(#g)" />
        <rect x="3" y="3" width="154" height="154" rx="43" fill="none" stroke="url(#g)" stroke-width="6" />
      </svg>
    `;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
}
