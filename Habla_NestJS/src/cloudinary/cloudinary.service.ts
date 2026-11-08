import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

// Las cuentas gratuitas de Cloudinary bloquean la entrega de PDFs subidos como imagen
// ("auto"): el archivo no se puede abrir. Los PDF y ZIP se suben como "raw" (con su extensión).
function documentUploadOptions(file: { mimetype?: string; originalname?: string }) {
  const name = String(file?.originalname || '');
  const isDocument =
    /^(application\/pdf|application\/zip|application\/x-zip-compressed)$/.test(file?.mimetype || '') ||
    /\.(pdf|zip)$/i.test(name);

  if (!isDocument) return { resource_type: 'auto' as const };

  const safeName = name.replace(/[^\w.\-]+/g, '_').replace(/^_+/, '') || 'documento.pdf';
  // Prefijo de tiempo: en raw el nombre es el identificador y no debe pisar otro archivo.
  return { resource_type: 'raw' as const, public_id: `${Date.now()}-${safeName}` };
}

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
            ...documentUploadOptions(file),
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
            ...documentUploadOptions(file),
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
            // "raw": las cuentas gratuitas de Cloudinary bloquean la entrega de PDFs
            // subidos como imagen ("auto"), y el PDF no se podía abrir ni enviar.
            // En raw el nombre conserva la extensión (.pdf / .xml).
            resource_type: 'raw',
            folder: `conecta-tax-documents/${documentId}`,
            public_id: fileName,
            use_filename: true,
            unique_filename: true,
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

  // Descarga un archivo por la API de Cloudinary (con la clave), que no tiene el bloqueo
  // de entrega de PDFs de las cuentas gratuitas.
  async downloadFile(url: string, publicId?: string | null): Promise<Buffer> {
    const resourceType = url.includes('/raw/upload/') ? 'raw' : 'image';
    let downloadUrl = url;

    if (publicId) {
      const isRaw = resourceType === 'raw';
      downloadUrl = cloudinary.utils.private_download_url(publicId, isRaw ? '' : 'pdf', {
        resource_type: resourceType,
        type: 'upload',
      });
    }

    const response = await fetch(downloadUrl, { signal: AbortSignal.timeout(20_000) });

    if (!response.ok) {
      throw new Error(`No se pudo descargar el archivo (${response.status})`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
