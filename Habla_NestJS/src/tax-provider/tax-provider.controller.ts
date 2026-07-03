import { Body, Controller, Delete, Get, Post, Request, UseGuards } from '@nestjs/common';
import type { AuthRequest } from '../auth/auth-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@prisma/client';
import { SaveTaxProviderCredentialDto } from './dto/save-tax-provider-credential.dto';
import { TaxProviderService } from './tax-provider.service';

@Controller('tax-provider')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PROFESSIONAL)
export class TaxProviderController {
  constructor(private readonly taxProviderService: TaxProviderService) {}

  @Get('me')
  getMe(@Request() req: AuthRequest) {
    return this.taxProviderService.getMyCredential(req.user);
  }

  @Post('me')
  saveMe(
    @Request() req: AuthRequest,
    @Body() body: SaveTaxProviderCredentialDto,
  ) {
    return this.taxProviderService.saveMyCredential(req.user, body);
  }

  @Delete('me')
  deleteMe(@Request() req: AuthRequest) {
    return this.taxProviderService.deleteMyCredential(req.user);
  }
}
