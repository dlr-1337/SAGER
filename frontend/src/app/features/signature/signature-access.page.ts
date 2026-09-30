import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { downloadExitDocument } from '../operations/long-exit-document.utils';
import { signatureStatusLabels } from '../operations/long-exit.utils';
import { formatOperationsTime } from '../operations/operations-local.utils';
import { ClicksignInstance, ClicksignWidgetService } from './clicksign-widget.service';
import {
  SignatureAccessApiService,
  SignatureAccessError,
  signatureAccessError,
} from './signature-access-api.service';
import { SignatureAccess, clicksignEnvironmentOrigin } from './signature-access.models';
import { consumeSignatureToken } from './signature-token.utils';

@Component({
  standalone: true,
  selector: 'sager-signature-access',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="invitation-shell">
      <header class="invitation-header">
        <img src="/if-goiano-urutai.png" alt="Instituto Federal Goiano, Campus Urutaí" />
        <div><strong>SAGER</strong><span>Autorização de saída longa</span></div>
      </header>
      <div class="invitation-content">
        @if (loading()) {
          <section class="invitation-card" role="status">
            <h1>Consultando autorização</h1>
            <p>Verificando o convite e a revisão atual do documento.</p>
          </section>
        } @else if (error()) {
          <section class="invitation-card" role="alert">
            <h1>Convite indisponível</h1>
            <p>{{ error() }}</p>
            @if (retryable()) {
              <button class="btn-secondary" type="button" (click)="load()">Tentar novamente</button>
            }
          </section>
        } @else if (access(); as invitation) {
          <section class="invitation-card" aria-labelledby="invitation-title">
            <h1 id="invitation-title">Revise a autorização de saída</h1>
            <p class="invitation-help">Documento da revisão {{ invitation.revisionNumber }}</p>
            <p>
              {{ invitation.guardianName }}, confira o período e o motivo da saída solicitada por
              {{ invitation.residentName }}. A assinatura do responsável será seguida pela análise
              do supervisor.
            </p>
            <dl class="invitation-summary">
              <div>
                <dt>Residente</dt>
                <dd>{{ invitation.residentName }}</dd>
              </div>
              <div>
                <dt>Matrícula</dt>
                <dd>{{ invitation.enrollment }}</dd>
              </div>
              <div>
                <dt>Responsável indicado</dt>
                <dd>{{ invitation.guardianName }} · {{ invitation.guardianRelationship }}</dd>
              </div>
              <div>
                <dt>Saída solicitada</dt>
                <dd>{{ formatTime(invitation.requestedDepartureAt) }}</dd>
              </div>
              <div>
                <dt>Retorno previsto</dt>
                <dd>{{ formatTime(invitation.expectedReturnAt) }}</dd>
              </div>
              <div>
                <dt>Motivo</dt>
                <dd>{{ invitation.reason }}</dd>
              </div>
              @if (invitation.notes) {
                <div>
                  <dt>Observações</dt>
                  <dd>{{ invitation.notes }}</dd>
                </div>
              }
            </dl>
            <p class="invitation-help">
              Datas e horas no horário de Brasília. Convite válido até
              {{ formatTime(invitation.expiresAt) }}.
            </p>
            <div class="document-actions">
              <button
                class="btn-secondary"
                type="button"
                [disabled]="downloading()"
                (click)="download()"
              >
                <span class="material-symbols-outlined" aria-hidden="true">picture_as_pdf</span>
                {{ downloading() ? 'Baixando documento…' : 'Baixar documento original' }}
              </button>
              <span>PDF da revisão {{ invitation.revisionNumber }}</span>
            </div>
            @if (documentError()) {
              <p class="invitation-error" role="alert">{{ documentError() }}</p>
            }
          </section>
          <section class="invitation-card signature-action" aria-labelledby="signature-title">
            <h2 id="signature-title">Autorização do responsável</h2>
            <p class="signature-status" role="status">{{ statuses[invitation.signatureStatus] }}</p>
            @if (invitation.signatureStatus === 'VALID') {
              <p>
                A assinatura desta revisão foi confirmada pelo servidor. A equipe da residência
                ainda precisa analisar a solicitação e registrar a liberação presencial.
              </p>
            } @else {
              @if (pendingConfirmation()) {
                <p class="invitation-notice" role="status">
                  O serviço informou a conclusão da assinatura. Atualize a situação para consultar a
                  confirmação do servidor.
                </p>
              }
              @if (invitation.widget.available && invitation.signatureStatus === 'PENDING') {
                @if (!widgetOpening() && !widgetLoaded() && !pendingConfirmation()) {
                  <p>
                    Baixe e leia o documento original desta revisão antes de abrir a assinatura.
                  </p>
                  <label class="invitation-check"
                    ><input type="checkbox" [formControl]="reviewed" /><span
                      >Li o documento original e conferi os dados desta revisão.</span
                    ></label
                  >
                  <button
                    class="btn"
                    type="button"
                    [disabled]="!documentDownloaded() || !reviewed.value"
                    (click)="startSignature()"
                  >
                    Abrir assinatura na Clicksign
                    <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                  </button>
                }
                @if (widgetOpening()) {
                  <p role="status">Carregando o serviço de assinatura…</p>
                }
                @if (widgetError()) {
                  <p class="invitation-error" role="alert">{{ widgetError() }}</p>
                }
                <div
                  #signingContainer
                  id="sager-signature-widget"
                  class="signing-container"
                  [class.signing-container-visible]="widgetOpening() || widgetLoaded()"
                  aria-label="Serviço de assinatura da Clicksign"
                ></div>
              } @else {
                <p>
                  O serviço de assinatura não está disponível para este convite neste momento.
                  Atualize a situação ou procure a equipe da residência.
                </p>
              }
              <p class="invitation-help">
                A entrega ou a leitura do convite não confirma a assinatura. A situação acima é
                informada pelo servidor.
              </p>
            }
            <div class="refresh-action">
              <button class="btn-secondary" type="button" (click)="load()">
                Atualizar situação
              </button>
            </div>
          </section>
        }
      </div>
      <footer class="invitation-footer">SAGER · IF Goiano Campus Urutaí</footer>
    </main>
  `,
  styleUrl: './signature-access.page.scss',
})
export class SignatureAccessPage implements OnDestroy {
  private readonly api = inject(SignatureAccessApiService);
  private readonly widgets = inject(ClicksignWidgetService);
  private readonly router = inject(Router);
  private readonly signingContainer = viewChild<ElementRef<HTMLElement>>('signingContainer');
  private token: string | null = consumeSignatureToken(window.location, window.history);
  private requestNumber = 0;
  private alive = true;
  private widget: ClicksignInstance | null = null;
  private widgetAbort: AbortController | null = null;
  private readonly invitationChanged = () => {
    this.token = consumeSignatureToken(window.location, window.history);
    void this.load();
  };
  readonly access = signal<SignatureAccess | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly retryable = signal(false);
  readonly downloading = signal(false);
  readonly documentDownloaded = signal(false);
  readonly documentError = signal('');
  readonly reviewed = new FormControl(false, { nonNullable: true });
  readonly widgetOpening = signal(false);
  readonly widgetLoaded = signal(false);
  readonly widgetError = signal('');
  readonly pendingConfirmation = signal(false);
  readonly statuses = signatureStatusLabels;
  readonly formatTime = formatOperationsTime;

  constructor() {
    window.addEventListener('hashchange', this.invitationChanged);
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (!(event instanceof NavigationEnd) || !window.location.hash) return;
      // The router can commit a hash navigation after the browser event was consumed.
      const token = consumeSignatureToken(window.location, window.history);
      if (token !== this.token) {
        this.token = token;
        void this.load();
      }
    });
    void this.load();
  }

  async load(): Promise<void> {
    const token = this.token;
    const requestNumber = ++this.requestNumber;
    this.stopWidget();
    this.access.set(null);
    this.downloading.set(false);
    this.documentDownloaded.set(false);
    this.reviewed.setValue(false);
    this.documentError.set('');
    this.widgetError.set('');
    this.pendingConfirmation.set(false);
    this.error.set('');
    this.retryable.set(false);
    this.loading.set(false);
    if (!token) {
      this.error.set(
        'Abra o convite individual mais recente recebido pelo WhatsApp. Se precisar de um novo convite, procure a equipe da residência.',
      );
      return;
    }
    this.loading.set(true);
    try {
      const invitation = await this.api.access(token);
      if (!this.alive || requestNumber !== this.requestNumber) return;
      if (
        ['EXPIRED', 'INVALIDATED'].includes(invitation.signatureStatus) ||
        Date.parse(invitation.now) >= Date.parse(invitation.expiresAt)
      ) {
        this.token = null;
        throw new SignatureAccessError(410);
      }
      this.access.set(invitation);
    } catch (error) {
      if (!this.alive || requestNumber !== this.requestNumber) return;
      const permanent =
        error instanceof SignatureAccessError && [401, 403, 404, 409, 410].includes(error.status);
      if (permanent) this.token = null;
      this.access.set(null);
      this.error.set(signatureAccessError(error));
      this.retryable.set(!!this.token);
    } finally {
      if (this.alive && requestNumber === this.requestNumber) this.loading.set(false);
    }
  }

  async download(): Promise<void> {
    const token = this.token;
    const invitation = this.access();
    const requestNumber = this.requestNumber;
    if (!token || !invitation || this.downloading()) return;
    this.downloading.set(true);
    this.documentError.set('');
    try {
      const blob = await this.api.document(token);
      if (!this.alive || requestNumber !== this.requestNumber || this.token !== token) return;
      downloadExitDocument(blob, invitation.documentVersionId, 'original');
      this.documentDownloaded.set(true);
    } catch (error) {
      if (!this.alive || requestNumber !== this.requestNumber) return;
      if (
        error instanceof SignatureAccessError &&
        [401, 403, 404, 409, 410].includes(error.status)
      ) {
        this.token = null;
        this.stopWidget();
        this.access.set(null);
        this.error.set(signatureAccessError(error));
        this.retryable.set(false);
      } else this.documentError.set(signatureAccessError(error));
    } finally {
      if (this.alive && requestNumber === this.requestNumber) this.downloading.set(false);
    }
  }

  async startSignature(): Promise<void> {
    const invitation = this.access();
    const token = this.token;
    const requestNumber = this.requestNumber;
    const container = this.signingContainer()?.nativeElement;
    const endpoint = invitation && clicksignEnvironmentOrigin(invitation.widget.environment);
    if (
      !token ||
      !invitation ||
      !endpoint ||
      !container ||
      invitation.signatureStatus !== 'PENDING' ||
      !invitation.widget.available ||
      !invitation.widget.signerId ||
      !this.documentDownloaded() ||
      !this.reviewed.value ||
      this.widgetOpening() ||
      this.widgetLoaded() ||
      this.pendingConfirmation()
    )
      return;
    this.stopWidget();
    const abort = new AbortController();
    this.widgetAbort = abort;
    this.widgetOpening.set(true);
    this.widgetError.set('');
    try {
      const fresh = await this.api.access(token);
      if (abort.signal.aborted || !this.alive || requestNumber !== this.requestNumber) return;
      if (
        fresh.bindingId !== invitation.bindingId ||
        fresh.documentVersionId !== invitation.documentVersionId ||
        ['EXPIRED', 'INVALIDATED'].includes(fresh.signatureStatus) ||
        Date.parse(fresh.now) >= Date.parse(fresh.expiresAt)
      )
        throw new SignatureAccessError(410);
      if (fresh.signatureStatus !== 'PENDING' || !fresh.widget.available) {
        this.stopWidget();
        this.access.set(fresh);
        return;
      }
      if (
        fresh.widget.signerId !== invitation.widget.signerId ||
        fresh.widget.environment !== invitation.widget.environment ||
        fresh.widget.libraryVersion !== invitation.widget.libraryVersion
      )
        throw new SignatureAccessError(409);
    } catch (error) {
      if (abort.signal.aborted || !this.alive || requestNumber !== this.requestNumber) return;
      this.stopWidget();
      const permanent =
        error instanceof SignatureAccessError && [401, 403, 404, 409, 410].includes(error.status);
      if (permanent) this.token = null;
      this.access.set(null);
      this.error.set(signatureAccessError(error));
      this.retryable.set(!!this.token);
      return;
    }
    try {
      const widget = await this.widgets.mount(
        container,
        { signerId: invitation.widget.signerId, endpoint },
        {
          loaded: () => {
            this.widgetOpening.set(false);
            this.widgetLoaded.set(true);
          },
          signed: () => this.pendingConfirmation.set(true),
        },
        abort.signal,
      );
      if (abort.signal.aborted || !this.alive) {
        widget.unmount();
        return;
      }
      this.widget = widget;
    } catch {
      if (!abort.signal.aborted && this.alive) {
        this.stopWidget();
        this.widgetError.set(
          'Não foi possível abrir o serviço de assinatura. Tente novamente ou procure a equipe da residência.',
        );
      }
    }
  }

  ngOnDestroy(): void {
    this.alive = false;
    window.removeEventListener('hashchange', this.invitationChanged);
    this.requestNumber++;
    this.stopWidget();
    this.token = null;
    this.access.set(null);
  }

  private stopWidget(): void {
    this.widgetAbort?.abort();
    this.widgetAbort = null;
    try {
      this.widget?.unmount();
    } catch {
      /* The invitation still closes when provider cleanup fails. */
    }
    this.widget = null;
    this.signingContainer()?.nativeElement.replaceChildren();
    this.widgetOpening.set(false);
    this.widgetLoaded.set(false);
  }
}
