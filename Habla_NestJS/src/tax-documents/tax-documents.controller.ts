import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthRequest } from '../auth/auth-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTaxDocumentDto } from './dto/create-tax-document.dto';
import { MarkTaxDocumentDto } from './dto/mark-tax-document.dto';
import { TaxDocumentsService } from './tax-documents.service';

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
  getDocumentsByProfessional(@Request() req: AuthRequest) {
    return this.taxDocumentsService.getDocumentsByProfessional(req.user);
  }

  @Get('professional/pending')
  getPendingDocumentsByProfessional(@Request() req: AuthRequest) {
    return this.taxDocumentsService.getPendingDocumentsByProfessional(req.user);
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
}
