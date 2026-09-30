import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

export const clicksignWidgetScript =
  'https://cdn-public-library.clicksign.com/embedded/embedded.min-2.1.0.js';
const scriptId = 'sager-clicksign-embedded-v3';
const endpointOrigins = new Set(['https://sandbox.clicksign.com', 'https://app.clicksign.com']);

export interface SignatureWidgetConfiguration {
  signerId: string;
  endpoint: string;
}
interface WidgetEvent {
  data?: { height?: unknown };
}
export interface ClicksignInstance {
  endpoint: string;
  origin: string;
  mount(containerId: string): void;
  unmount(): void;
  on(event: 'loaded' | 'signed' | 'resized', callback: (event: WidgetEvent) => void): void;
}
type ClicksignConstructor = new (signerId: string) => ClicksignInstance;

export function approvedClicksignEndpoint(value: string): string | null {
  try {
    const endpoint = new URL(value);
    if (
      !endpointOrigins.has(endpoint.origin) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.pathname !== '/' ||
      endpoint.search ||
      endpoint.hash
    )
      return null;
    return endpoint.origin;
  } catch {
    return null;
  }
}

/** The widget informs the interface; only the backend can validate a signature. */
@Injectable({ providedIn: 'root' })
export class ClicksignWidgetService {
  private readonly document = inject(DOCUMENT);
  private loading: Promise<ClicksignConstructor> | null = null;

  async mount(
    container: HTMLElement,
    configuration: SignatureWidgetConfiguration,
    callbacks: { loaded: () => void; signed: () => void },
    signal?: AbortSignal,
  ): Promise<ClicksignInstance> {
    const endpoint = approvedClicksignEndpoint(configuration.endpoint);
    const browser = this.document.defaultView;
    if (
      !endpoint ||
      !browser ||
      !['http:', 'https:'].includes(browser.location.protocol) ||
      (endpoint === 'https://app.clicksign.com' && browser.location.protocol !== 'https:')
    )
      throw new Error('O serviço de assinatura não está configurado para este acesso.');
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        configuration.signerId,
      )
    )
      throw new Error('O signatário do documento não está disponível.');
    if (!container.id || !container.isConnected || container.ownerDocument !== this.document)
      throw new Error('Não foi possível preparar a área de assinatura.');
    const Clicksign = await this.library();
    if (signal?.aborted || !container.isConnected)
      throw new DOMException('Operação cancelada.', 'AbortError');
    const widget = new Clicksign(configuration.signerId);
    widget.endpoint = endpoint;
    widget.origin = browser.location.origin;
    const titleFrame = () =>
      container.querySelectorAll('iframe').forEach((frame) => {
        if (!frame.title) frame.title = 'Assinatura do documento na Clicksign';
      });
    widget.on('loaded', () => {
      if (!signal?.aborted) {
        titleFrame();
        callbacks.loaded();
      }
    });
    widget.on('signed', () => {
      if (!signal?.aborted) callbacks.signed();
    });
    widget.on('resized', (event) => {
      if (signal?.aborted) return;
      const height = Number(event?.data?.height);
      if (Number.isFinite(height) && height > 0 && height <= 4000)
        container.style.height = `${Math.max(320, height)}px`;
      titleFrame();
    });
    try {
      widget.mount(container.id);
      titleFrame();
    } catch {
      try {
        widget.unmount();
      } catch {
        /* Provider cleanup cannot replace the visible error. */
      }
      throw new Error('Não foi possível abrir o serviço de assinatura. Tente novamente.');
    }
    return widget;
  }

  private library(): Promise<ClicksignConstructor> {
    if (this.loading) return this.loading;
    this.loading = new Promise<ClicksignConstructor>((resolve, reject) => {
      const browser = this.document.defaultView;
      if (!browser) {
        reject(new Error('A assinatura exige um navegador.'));
        return;
      }
      const previous = this.document.getElementById(scriptId);
      if (
        previous &&
        (!(previous instanceof browser.HTMLScriptElement) || previous.src !== clicksignWidgetScript)
      ) {
        reject(new Error('A biblioteca de assinatura não pôde ser verificada.'));
        return;
      }
      const script =
        (previous as HTMLScriptElement | null) ?? this.document.createElement('script');
      const timeout = browser.setTimeout(() => failed(), 20_000);
      const finish = () => {
        browser.clearTimeout(timeout);
        const constructor = (browser as Window & { Clicksign?: ClicksignConstructor }).Clicksign;
        if (typeof constructor !== 'function') {
          failed();
          return;
        }
        script.dataset['loaded'] = 'true';
        resolve(constructor);
      };
      const failed = () => {
        browser.clearTimeout(timeout);
        script.remove();
        this.loading = null;
        reject(new Error('Não foi possível carregar o serviço de assinatura. Tente novamente.'));
      };
      if (script.dataset['loaded'] === 'true') {
        finish();
        return;
      }
      script.addEventListener('load', finish, { once: true });
      script.addEventListener('error', failed, { once: true });
      if (!previous) {
        script.id = scriptId;
        script.src = clicksignWidgetScript;
        script.async = true;
        script.referrerPolicy = 'no-referrer';
        this.document.body.appendChild(script);
      }
    }).catch((error: unknown) => {
      this.loading = null;
      throw error;
    });
    return this.loading;
  }
}
