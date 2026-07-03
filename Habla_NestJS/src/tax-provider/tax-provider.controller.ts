import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthRequest } from '../auth/auth-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@prisma/client';
import { SaveTaxProviderCredentialDto } from './dto/save-tax-provider-credential.dto';
import { TaxProviderService } from './tax-provider.service';

type UploadedCertificateFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

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
  @UseInterceptors(FileInterceptor('certificate'))
  saveMe(
    @Request() req: AuthRequest,
    @Body() body: SaveTaxProviderCredentialDto,
    @UploadedFile() certificate?: UploadedCertificateFile,
  ) {
    return this.taxProviderService.saveMyCredential(req.user, body, certificate);
  }

  @Post('me/test-auth')
  testAuth(@Request() req: AuthRequest) {
    return this.taxProviderService.testMySiiAuthentication(req.user);
  }

  @Delete('me')
  deleteMe(@Request() req: AuthRequest) {
    return this.taxProviderService.deleteMyCredential(req.user);
  }
}
