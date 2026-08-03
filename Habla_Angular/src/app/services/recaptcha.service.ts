import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

type Grecaptcha = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

export type RecaptchaClientErrorCode =
  | 'MISSING_SITE_KEY'
  | 'SCRIPT_LOAD_FAILED'
  | 'SCRIPT_LOAD_TIMEOUT'
  | 'NOT_AVAILABLE'
  | 'EXECUTE_FAILED'
  | 'EXECUTE_TIMEOUT';

export class RecaptchaClientError extends Error {
  constructor(
    public readonly code: RecaptchaClientErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'RecaptchaClientError';
  }
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

@Injectable({
  providedIn: 'root',
})
export class RecaptchaService {
  private scriptPromise: Promise<void> | null = null;
  private readonly timeoutMs = 12000;

  preload(): Promise<void> {
    const siteKey = environment.recaptchaSiteKey;

    if (!siteKey || siteKey.startsWith('REPLACE_WITH_')) {
      return Promise.resolve();
    }

    return this.loadScript(siteKey);
  }

  async execute(action: string): Promise<string> {
    const siteKey = environment.recaptchaSiteKey;

    if (!siteKey || siteKey.startsWith('REPLACE_WITH_')) {
      throw new RecaptchaClientError(
        'MISSING_SITE_KEY',
        'La clave pública de reCAPTCHA no está configurada.',
      );
    }

    await this.withTimeout(
      this.loadScript(siteKey),
      'SCRIPT_LOAD_TIMEOUT',
      'La carga de reCAPTCHA tardó demasiado.',
    );

    if (!window.grecaptcha?.execute) {
      throw new RecaptchaClientError(
        'NOT_AVAILABLE',
        'Google reCAPTCHA no quedó disponible en el navegador.',
      );
    }

    try {
      return await this.withTimeout(
        window.grecaptcha.execute(siteKey, { action }),
        'EXECUTE_TIMEOUT',
        'La generación del token reCAPTCHA tardó demasiado.',
      );
    } catch (error) {
      if (error instanceof RecaptchaClientError) throw error;

      throw new RecaptchaClientError(
        'EXECUTE_FAILED',
        'Google reCAPTCHA rechazó la generación del token.',
        { cause: error },
      );
    }
  }

  private loadScript(siteKey: string): Promise<void> {
    if (this.scriptPromise) {
      return this.scriptPromise;
    }

    const scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-recaptcha="v3"]',
      );

      if (existing) {
        if (window.grecaptcha?.ready) {
          window.grecaptcha.ready(() => resolve());
          return;
        }

        existing.addEventListener(
          'load',
          () => {
            if (!window.grecaptcha?.ready) {
              reject(
                new RecaptchaClientError(
                  'NOT_AVAILABLE',
                  'El script de reCAPTCHA cargó sin exponer su API.',
                ),
              );
              return;
            }

            window.grecaptcha.ready(() => resolve());
          },
          { once: true },
        );
        existing.addEventListener(
          'error',
          () =>
            reject(
              new RecaptchaClientError(
                'SCRIPT_LOAD_FAILED',
                'El navegador no pudo cargar Google reCAPTCHA.',
              ),
            ),
          { once: true },
        );
        return;
      }

      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.defer = true;
      script.dataset['recaptcha'] = 'v3';
      script.onload = () => {
        if (!window.grecaptcha?.ready) {
          reject(
            new RecaptchaClientError(
              'NOT_AVAILABLE',
              'El script de reCAPTCHA cargó sin exponer su API.',
            ),
          );
          return;
        }

        window.grecaptcha.ready(() => resolve());
      };
      script.onerror = () =>
        reject(
          new RecaptchaClientError(
            'SCRIPT_LOAD_FAILED',
            'El navegador no pudo cargar Google reCAPTCHA.',
          ),
        );
      document.head.appendChild(script);
    }).catch((error) => {
      this.scriptPromise = null;
      throw error;
    });

    this.scriptPromise = scriptPromise;
    return scriptPromise;
  }

  private withTimeout<T>(
    operation: Promise<T>,
    code: RecaptchaClientErrorCode,
    message: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new RecaptchaClientError(code, message)),
        this.timeoutMs,
      );

      operation.then(
        (result) => {
          window.clearTimeout(timer);
          resolve(result);
        },
        (error) => {
          window.clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
}
