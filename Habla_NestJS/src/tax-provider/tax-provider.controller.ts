import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { AuthRequest } from '../auth/auth-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@prisma/client';
import { SaveTaxFolioRangeDto } from './dto/save-tax-folio-range.dto';
import { SaveTaxProviderCredentialDto } from './dto/save-tax-provider-credential.dto';
import { TaxProviderService } from './tax-provider.service';

type UploadedCertificateFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

type UploadedTaxFile = UploadedCertificateFile;

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
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('certificate', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
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

  @Get('me/folios')
  getFolios(@Request() req: AuthRequest) {
    return this.taxProviderService.getMyFolioRanges(req.user);
  }

  @Post('me/folios')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('caf', {
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
    }),
  )
  saveFolioRange(
    @Request() req: AuthRequest,
    @Body() body: SaveTaxFolioRangeDto,
    @UploadedFile() caf?: UploadedTaxFile,
  ) {
    return this.taxProviderService.saveMyFolioRange(req.user, body, caf);
  }

  @Delete('me/folios/:id')
  deleteFolioRange(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.taxProviderService.deleteMyFolioRange(req.user, id);
  }

  @Delete('me')
  deleteMe(@Request() req: AuthRequest) {
    return this.taxProviderService.deleteMyCredential(req.user);
  }
}
