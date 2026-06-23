import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';

type ProfileEventBody = {
  type?: 'VIEW' | 'COPY_LINK' | 'SHARE';
};

@Controller('professionals/public')
export class ProfessionalsPublicController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findPublicProfessionals(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('specialty') specialty?: string,
    @Query('professionId') professionId?: string,
    @Query('professionSlug') professionSlug?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('attentionMode') attentionMode?: string,
  ) {
    return this.usersService.findProfessionals({
      page: Number(page) || 1,
      limit: Number(limit) || 12,
      search,
      specialty,
      professionId,
      professionSlug,
      categorySlug,
      attentionMode,
    });
  }

  @Get(':slug')
  async getPublicProfessional(@Param('slug') slug: string) {
    const professional = await this.usersService.getPublicProfessionalBySlug(slug);

    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    return professional;
  }

  @Post(':slug/events')
  async recordPublicProfessionalEvent(
    @Param('slug') slug: string,
    @Body() body: ProfileEventBody,
  ) {
    if (!body.type || !['VIEW', 'COPY_LINK', 'SHARE'].includes(body.type)) {
      throw new BadRequestException('Invalid profile event type');
    }

    const event = await this.usersService.recordProfessionalProfileEvent(
      slug,
      body.type,
    );

    if (!event) {
      throw new NotFoundException('Professional not found');
    }

    return { ok: true };
  }
}
