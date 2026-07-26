import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

type Grecaptcha = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

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

  async execute(action: string): Promise<string> {
    const siteKey = environment.recaptchaSiteKey;

    if (!siteKey || siteKey.startsWith('REPLACE_WITH_')) {
      return '';
    }

    await this.withTimeout(this.loadScript(siteKey));

    if (!window.grecaptcha?.execute) {
      throw new Error('reCAPTCHA no disponible');
    }

    return this.withTimeout(window.grecaptcha.execute(siteKey, { action }));
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
        window.grecaptcha?.ready(() => resolve());
        return;
      }

      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.defer = true;
      script.dataset['recaptcha'] = 'v3';
      script.onload = () => window.grecaptcha?.ready(() => resolve());
      script.onerror = () => reject(new Error('No se pudo cargar reCAPTCHA'));
      document.head.appendChild(script);
    }).catch((error) => {
      this.scriptPromise = null;
      throw error;
    });

    this.scriptPromise = scriptPromise;
    return scriptPromise;
  }

  private withTimeout<T>(operation: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error('reCAPTCHA tardó demasiado en responder')),
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
