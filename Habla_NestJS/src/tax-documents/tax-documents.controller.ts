import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthRequest } from '../auth/auth-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { IssueLibreDteDocumentDto } from '../libredte/dto/issue-libredte-document.dto';
import { CreateTaxDocumentDto } from './dto/create-tax-document.dto';
import { MarkTaxDocumentDto } from './dto/mark-tax-document.dto';
import { TaxDocumentsService } from './tax-documents.service';
import { Role } from '@prisma/client';

type AdminTaxDocumentQuery = {
  status?: string;
  professionalId?: string;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
};

type ProfessionalTaxDocumentQuery = {
  search?: string;
  status?: string;
  patient?: string;
  fromDate?: string;
  toDate?: string;
  page?: string;
  limit?: string;
};

@Controller('tax-documents')
@UseGuards(JwtAuthGuard)
export class TaxDocumentsController {
  constructor(private readonly taxDocumentsService: TaxDocumentsService) {}

  @Post()
  createDocument(
    @Request() req: AuthRequest,
    @Body() body: CreateTaxDocumentDto,
  ) {
    return this.taxDocumentsService.createDocument(req.user, body);
  }

  @Get('appointment/:appointmentId')
  getDocumentByAppointment(
    @Param('appointmentId') appointmentId: string,
    @Request() req: AuthRequest,
  ) {
    return this.taxDocumentsService.getDocumentByAppointment(
      appointmentId,
      req.user,
    );
  }

  @Get('my')
  getDocumentsByUser(@Request() req: AuthRequest) {
    return this.taxDocumentsService.getDocumentsByUser(req.user);
  }

  @Get('professional')
  getDocumentsByProfessional(
    @Request() req: AuthRequest,
    @Query() query: ProfessionalTaxDocumentQuery,
  ) {
    return this.taxDocumentsService.getDocumentsByProfessional(req.user, query);
  }

  @Get('professional/pending')
  getPendingDocumentsByProfessional(@Request() req: AuthRequest) {
    return this.taxDocumentsService.getPendingDocumentsByProfessional(req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/summary')
  getAdminSummary() {
    return this.taxDocumentsService.getAdminSummary();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin')
  getAdminDocuments(@Query() query: AdminTaxDocumentQuery) {
    return this.taxDocumentsService.getAdminDocuments(query);
  }

  @Get(':id')
  getDocumentById(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.taxDocumentsService.getDocumentById(id, req.user);
  }

  @Post(':id/upload-file')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Request() req: AuthRequest,
  ) {
    return this.taxDocumentsService.uploadDocumentFile(id, req.user, file);
  }

  @Patch(':id/uploaded')
  markAsUploaded(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() body: MarkTaxDocumentDto,
  ) {
    return this.taxDocumentsService.markAsUploaded(id, req.user, body.message);
  }

  @Patch(':id/generated')
  markAsGenerated(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() body: MarkTaxDocumentDto,
  ) {
    return this.taxDocumentsService.markAsGenerated(id, req.user, body.message);
  }

  @Patch(':id/sent')
  markAsSent(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() body: MarkTaxDocumentDto,
  ) {
    return this.taxDocumentsService.markAsSent(id, req.user, body.message);
  }

  @Post(':id/resend-email')
  resendEmail(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.taxDocumentsService.resendTaxDocumentEmail(id, req.user);
  }

  @Post(':id/finalize-libredte')
  finalizeLibreDteDocument(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ) {
    return this.taxDocumentsService.finalizeLibreDteDocument(id, req.user);
  }

  @Post(':id/issue-libredte')
  issueLibreDteDocument(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() body: IssueLibreDteDocumentDto,
  ) {
    return this.taxDocumentsService.issueLibreDteDocument(
      id,
      req.user,
      body.kind,
    );
  }

  @Post(':id/prepare-sii-draft')
  prepareSiiDraft(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.taxDocumentsService.prepareSiiDraft(id, req.user);
  }

  @Post(':id/sync-provider-status')
  syncProviderStatus(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.taxDocumentsService.syncLibreDteStatus(id, req.user);
  }

  @Get(':id/pdf')
  getProviderPdf(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.taxDocumentsService.getLibreDteResource(id, req.user, 'pdf');
  }

  @Get(':id/xml')
  getProviderXml(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.taxDocumentsService.getLibreDteResource(id, req.user, 'xml');
  }
}
