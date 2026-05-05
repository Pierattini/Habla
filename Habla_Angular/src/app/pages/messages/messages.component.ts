import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { MessagesService } from '../../services/messages.service';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterLink],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.scss'],
})
export class MessagesComponent implements OnInit {
  conversations: any[] = [];

  constructor(private messagesService: MessagesService) {}

  ngOnInit() {
    this.loadConversations();
  }
ionViewWillEnter() {
  this.loadConversations();
}
  loadConversations() {
    this.messagesService.getConversations().subscribe({
      next: (data) => {
        this.conversations = data;
        console.log('Conversations:', data);
      },
      error: (err) => {
        console.error(err);
      }
    });
  }
}