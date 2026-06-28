import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GoogleCalendarService } from './google-calendar.service';
import { MeetingService } from './meeting.service';
import { MicrosoftTeamsService } from './microsoft-teams.service';
import { ZoomService } from './zoom.service';

interface AuthRequest extends ExpressRequest {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@Controller('meetings')
export class MeetingsController {
  constructor(
    private readonly meetingService: MeetingService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly zoomService: ZoomService,
    private readonly microsoftTeamsService: MicrosoftTeamsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('google/status')
  getGoogleStatus(@Request() req: AuthRequest) {
    return this.googleCalendarService.getConnectionStatus(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('google/connect')
  connectGoogle(@Request() req: AuthRequest) {
    return {
      url: this.googleCalendarService.buildAuthUrl(req.user.id),
    };
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.googleCalendarService.handleOAuthCallback(code, state);

    return res.redirect(
      `${this.getFrontendUrl()}/tabs/professional-dashboard?google=connected`,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('google/disconnect')
  disconnectGoogle(@Request() req: AuthRequest) {
    return this.googleCalendarService.disconnect(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('zoom/status')
  getZoomStatus(@Request() req: AuthRequest) {
    return this.zoomService.getConnectionStatus(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('zoom/connect')
  connectZoom(@Request() req: AuthRequest) {
    return {
      url: this.zoomService.buildAuthUrl(req.user.id),
    };
  }

  @Get('zoom/callback')
  async zoomCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.zoomService.handleOAuthCallback(code, state);

    return res.redirect(
      `${this.getFrontendUrl()}/tabs/professional-dashboard?zoom=connected`,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('zoom/disconnect')
  disconnectZoom(@Request() req: AuthRequest) {
    return this.zoomService.disconnect(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('teams/status')
  getTeamsStatus(@Request() req: AuthRequest) {
    return this.microsoftTeamsService.getConnectionStatus(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('teams/connect')
  connectTeams(@Request() req: AuthRequest) {
    return {
      url: this.microsoftTeamsService.buildAuthUrl(req.user.id),
    };
  }

  @Get('teams/callback')
  async teamsCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.microsoftTeamsService.handleOAuthCallback(code, state);

    return res.redirect(
      `${this.getFrontendUrl()}/tabs/professional-dashboard?teams=connected`,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('teams/disconnect')
  disconnectTeams(@Request() req: AuthRequest) {
    return this.microsoftTeamsService.disconnect(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':appointmentId/:token')
  getMeetingRoom(
    @Param('appointmentId') appointmentId: string,
    @Param('token') token: string,
    @Request() req: AuthRequest,
  ) {
    return this.meetingService.getConectaMeetingRoom(
      appointmentId,
      token,
      req.user.id,
    );
  }

  private getFrontendUrl(): string {
    return (
      process.env.PUBLIC_FRONTEND_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:4200'
    ).replace(/\/$/, '');
  }
}
