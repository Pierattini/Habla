import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadFile(file: any) {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: 'auto',
            folder: 'conecta-chat-files',
          },
          (error, result) => {
            if (error) {
              return reject(new Error(String(error.message)));
            }

            resolve(result);
          },
        )
        .end(file.buffer);
    });
  }

  async uploadTaxDocument(documentId: string, file: any) {
    return new Promise<any>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: 'auto',
            folder: `conecta-tax-documents/${documentId}`,
            use_filename: true,
            unique_filename: true,
          },
          (error, result) => {
            if (error) {
              return reject(new Error(String(error.message)));
            }

            resolve(result);
          },
        )
        .end(file.buffer);
    });
  }

  async uploadTaxDocumentBuffer(
    documentId: string,
    buffer: Buffer,
    fileName: string,
    mimeType?: string,
  ) {
    return new Promise<any>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: 'auto',
            folder: `conecta-tax-documents/${documentId}`,
            public_id: fileName.replace(/\.[^.]+$/, ''),
            use_filename: true,
            unique_filename: true,
            format: fileName.split('.').pop(),
            context: mimeType ? { mime_type: mimeType } : undefined,
          },
          (error, result) => {
            if (error) {
              return reject(new Error(String(error.message)));
            }

            resolve(result);
          },
        )
        .end(buffer);
    });
  }
}
