import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LibreDteIssueResult,
  LibreDteResourceFormat,
  LibreDteStatusResult,
} from './libredte.types';

export type LibreDteDownloadedResource = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
};

@Injectable()
export class LibreDteClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly issuePath: string;
  private readonly statusPath: string;
  private readonly resourcePath: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.trimTrailingSlash(
      this.config.get<string>('LIBREDTE_BASE_URL') || 'https://www.libredte.cl',
    );
    this.apiKey = this.config.get<string>('LIBREDTE_API_KEY') || undefined;
    this.issuePath =
      this.config.get<string>('LIBREDTE_ISSUE_PATH') ||
      '/api/dte/documentos/emitir';
    this.statusPath =
      this.config.get<string>('LIBREDTE_STATUS_PATH') ||
      '/api/dte/documentos/{id}/estado';
    this.resourcePath =
      this.config.get<string>('LIBREDTE_RESOURCE_PATH') ||
      '/api/dte/documentos/{id}/{format}';
    this.timeoutMs = Number(this.config.get<string>('LIBREDTE_TIMEOUT_MS') || 15000);
  }

  async issue(
    payload: Record<string, unknown>,
    apiKey?: string,
  ): Promise<LibreDteIssueResult> {
    const response = await this.request(this.issuePath, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, apiKey);

    return {
      dteCode: Number(payload.dte),
      folio: this.pickString(response, ['folio', 'Folio']),
      providerDocumentId: this.pickString(response, ['id', 'documento', 'documentId', 'codigo']),
      siiTrackId: this.pickString(response, ['trackId', 'track_id', 'siiTrackId']),
      siiStatus: this.pickString(response, ['estado', 'status', 'siiStatus']),
      siiStatusDetail: this.pickString(response, ['glosa', 'detalle', 'message']),
      pdfUrl: this.pickString(response, ['pdf', 'pdfUrl', 'url_pdf']),
      xmlUrl: this.pickString(response, ['xml', 'xmlUrl', 'url_xml']),
      providerPayload: payload,
      providerResponse: response,
    };
  }

  async getStatus(providerDocumentId: string): Promise<LibreDteStatusResult> {
    const response = await this.request(
      this.statusPath.replace('{id}', encodeURIComponent(providerDocumentId)),
      { method: 'GET' },
    );

    return {
      siiTrackId: this.pickString(response, ['trackId', 'track_id', 'siiTrackId']),
      siiStatus: this.pickString(response, ['estado', 'status', 'siiStatus']),
      siiStatusDetail: this.pickString(response, ['glosa', 'detalle', 'message']),
      providerResponse: response,
    };
  }

  async getResourceUrl(
    providerDocumentId: string,
    format: LibreDteResourceFormat,
  ): Promise<string> {
    return this.buildUrl(
      this.resourcePath
        .replace('{id}', encodeURIComponent(providerDocumentId))
        .replace('{format}', format),
    );
  }

  async downloadResource(
    providerDocumentId: string,
    format: LibreDteResourceFormat,
    apiKey?: string,
  ): Promise<LibreDteDownloadedResource> {
    const requestApiKey = apiKey || this.apiKey;

    if (!requestApiKey) {
      throw new ServiceUnavailableException(
        'LIBREDTE_API_KEY is not configured',
      );
    }

    const url = this.buildUrl(
      this.resourcePath
        .replace('{id}', encodeURIComponent(providerDocumentId))
        .replace('{format}', format),
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${requestApiKey}`,
          'X-API-Key': requestApiKey,
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new BadGatewayException({
          message: 'LibreDTE resource download failed',
          status: response.status,
          response: text ? this.parseBody(text) : null,
        });
      }

      const arrayBuffer = await response.arrayBuffer();
      const contentType =
        response.headers.get('content-type') ||
        (format === 'pdf' ? 'application/pdf' : 'application/xml');

      return {
        buffer: Buffer.from(arrayBuffer),
        contentType,
        fileName: `documento-${providerDocumentId}.${format}`,
      };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException({
        message: 'LibreDTE resource is not available',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async request(
    path: string,
    init: RequestInit,
    apiKey?: string,
  ): Promise<unknown> {
    const requestApiKey = apiKey || this.apiKey;

    if (!requestApiKey) {
      throw new ServiceUnavailableException(
        'LIBREDTE_API_KEY is not configured',
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.buildUrl(path), {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${requestApiKey}`,
          'X-API-Key': requestApiKey,
          ...(init.headers || {}),
        },
      });

      const text = await response.text();
      const body = text ? this.parseBody(text) : null;

      if (!response.ok) {
        throw new BadGatewayException({
          message: 'LibreDTE request failed',
          status: response.status,
          response: body,
        });
      }

      return body;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException({
        message: 'LibreDTE is not available',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private buildUrl(path: string): string {
    if (path.startsWith('http')) {
      return path;
    }

    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private parseBody(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private pickString(source: unknown, keys: string[]): string | null {
    if (!source || typeof source !== 'object') {
      return null;
    }

    const record = source as Record<string, unknown>;

    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
      if (typeof value === 'number') {
        return String(value);
      }
    }

    return null;
  }

  private trimTrailingSlash(value: string): string {
    return value.endsWith('/') ? value.slice(0, -1) : value;
  }
}
