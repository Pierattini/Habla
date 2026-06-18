import { Controller, Get, Query } from '@nestjs/common';
import { ProfessionsService } from './professions.service';

@Controller('professions')
export class ProfessionsController {
  constructor(private readonly professionsService: ProfessionsService) {}

  @Get('categories')
  findCategories() {
    return this.professionsService.findCategories();
  }

  @Get()
  findProfessions(
    @Query('categorySlug') categorySlug?: string,
    @Query('search') search?: string,
  ) {
    return this.professionsService.findProfessions({ categorySlug, search });
  }
}
