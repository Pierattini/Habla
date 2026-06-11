import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';

@Injectable()
export class StorageService {
  async uploadDocument(documentId: string, file: any) {
    const safeName = this.buildSafeFileName(file.originalname);
    const relativeDir = join('uploads', 'tax-documents', documentId);
    const absoluteDir = join(process.cwd(), relativeDir);
    const relativePath = join(relativeDir, safeName);
    const absolutePath = join(process.cwd(), relativePath);

    await mkdir(absoluteDir, { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      fileName: safeName,
      localFilePath: relativePath,
      url: `/${relativePath.replace(/\\/g, '/')}`,
      publicId: null,
    };
  }

  private buildSafeFileName(originalName: string) {
    const extension = extname(originalName).toLowerCase();
    const baseName = originalName
      .replace(extension, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80);

    return `${Date.now()}-${baseName || 'document'}${extension}`;
  }

  // Future adapters can keep this public contract and switch implementation to:
  // - Cloudinary
  // - AWS S3
  // - Azure Blob Storage
}
