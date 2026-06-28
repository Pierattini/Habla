import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonSpinner,
} from '@ionic/angular/standalone';
import { MeetingRoom, MeetingService } from '../../services/meeting.service';

@Component({
  selector: 'app-meeting',
  standalone: true,
  imports: [CommonModule, IonButton, IonContent, IonSpinner],
  templateUrl: './meeting.component.html',
  styleUrl: './meeting.component.scss',
})
export class MeetingComponent implements OnInit {
  loading = true;
  room: MeetingRoom | null = null;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private meetingService: MeetingService,
  ) {}

  ngOnInit(): void {
    const appointmentId = this.route.snapshot.paramMap.get('appointmentId');
    const token = this.route.snapshot.paramMap.get('token');

    if (!appointmentId || !token) {
      this.loading = false;
      this.errorMessage = 'Enlace de sala invalido.';
      return;
    }

    this.meetingService.getRoom(appointmentId, token).subscribe({
      next: (room) => {
        this.room = room;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;

        if (error?.status === 401) {
          this.errorMessage = 'Debes iniciar sesion para acceder a esta sala.';
          return;
        }

        if (error?.status === 403) {
          this.errorMessage = 'Acceso denegado a esta sala.';
          return;
        }

        this.errorMessage =
          error?.error?.message || 'No pudimos cargar la sala.';
      },
    });
  }

  get formattedDate(): string {
    if (!this.room?.date) return '';

    return new Intl.DateTimeFormat('es', {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date(this.room.date));
  }

  joinMeeting(): void {
    if (!this.room?.isAvailable) return;

    alert(
      'La sala de videollamada de Conecta esta preparada. Audio y video se integraran en la siguiente fase.',
    );
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
