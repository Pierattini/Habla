import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MeetingsController } from './meetings.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { MeetingService } from './meeting.service';
import { MicrosoftTeamsService } from './microsoft-teams.service';
import { ZoomService } from './zoom.service';

@Module({
  imports: [PrismaModule],
  controllers: [MeetingsController],
  providers: [
    MeetingService,
    GoogleCalendarService,
    ZoomService,
    MicrosoftTeamsService,
  ],
  exports: [
    MeetingService,
    GoogleCalendarService,
    ZoomService,
    MicrosoftTeamsService,
  ],
})
export class MeetingsModule {}
