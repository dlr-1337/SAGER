import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  CanDeactivateFn,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { debounceTime } from 'rxjs';
import { DemoSessionService } from '../../core/demo-session.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { UnsavedForms, UnsavedFormDirective } from '../../shared/unsaved-form';
import { GuardianApiService, GuardianRecord } from '../management/guardian-api.service';
import { OperationsApiError } from '../operations/operations-local-api.service';
import { formatOperationsTime } from '../operations/operations-local.utils';
import { ConversationPolling } from './conversation-polling';
import { ConversationsApiService } from './conversations-api.service';
import {
  Conversation,
  ConversationMessage,
  DeliveryStatus,
  MessageKind,
  OpenExit,
  SessionUnavailableReason,
  SessionView,
} from './conversations.models';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT = 4096;
const MAX_CAPTION = 1024;
const THREAD_DELAY_MS = 5000;
const LIST_DELAY_MS = 15_000;
const QR_REFRESH_MS = 20_000;
// Only narrows the file picker: the server decides by the bytes.
const SENDABLE_TYPES =
  'image/jpeg,image/png,image/webp,application/pdf,audio/ogg,audio/mpeg,audio/webm,audio/mp4';
const RECORDING_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];
const RECORDING_EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
};

const zone = 'America/Sao_Paulo';
const clock = new Intl.DateTimeFormat('pt-BR', {
  timeZone: zone,
  hour: '2-digit',
  minute: '2-digit',
});
const calendar = new Intl.DateTimeFormat('pt-BR', {
  timeZone: zone,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const dayLabel = (instant: string): string => {
  const day = calendar.format(new Date(instant));
  if (day === calendar.format(Date.now())) return 'Hoje';
  return day === calendar.format(Date.now() - 86_400_000) ? 'Ontem' : day;
};
const listTime = (instant: string | null): string => {
  if (!instant) return '';
  const day = dayLabel(instant);
  return day === 'Hoje' ? clock.format(new Date(instant)) : day;
};
const formatPhone = (phone: string | null): string =>
  phone?.replace(/^\+55(\d{2})(\d{4,5})(\d{4})$/, '+55 $1 $2-$3') ?? '';
const formatSize = (bytes: number): string =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
const failure = (error: unknown, fallback: string): string =>
  error instanceof OperationsApiError ? error.message : fallback;
const status = (error: unknown): number | undefined =>
  error instanceof OperationsApiError ? error.status : undefined;

const kindLabels: Record<MessageKind, { label: string; icon: string }> = {
  TEXT: { label: 'Mensagem', icon: 'chat' },
  IMAGE: { label: 'Foto', icon: 'image' },
  AUDIO: { label: 'Áudio', icon: 'mic' },
  DOCUMENT: { label: 'Documento', icon: 'description' },
};
const deliveryLabels: Record<DeliveryStatus, { label: string; icon: string; tone: string }> = {
  QUEUED: { label: 'Na fila', icon: 'schedule', tone: 'neutral' },
  SENT: { label: 'Enviada', icon: 'check', tone: 'neutral' },
  DELIVERED: { label: 'Entregue', icon: 'done_all', tone: 'neutral' },
  READ: { label: 'Lida', icon: 'visibility', tone: 'read' },
  FAILED: { label: 'Não enviada', icon: 'error', tone: 'danger' },
  UNCERTAIN: { label: 'Envio não confirmado', icon: 'help', tone: 'warning' },
};
const unavailableTexts: Record<SessionUnavailableReason, string> = {
  gateway_disabled:
    'O WhatsApp está desligado. O histórico segue disponível, mas o envio está indisponível.',
  session_not_ready:
    'O WhatsApp não está conectado. O histórico segue disponível, mas o envio está indisponível até a conexão voltar.',
  gateway_unreachable:
    'O serviço do WhatsApp não respondeu. O histórico segue disponível, mas o envio está indisponível por enquanto.',
};
const sessionStates: Record<string, { label: string; icon: string; tone: string; text: string }> = {
  DISABLED: {
    label: 'Desligado',
    icon: 'power_off',
    tone: 'neutral',
    text: 'O WhatsApp ainda não foi ligado. Peça ao suporte para ligar.',
  },
  STOPPED: {
    label: 'Parado',
    icon: 'pause_circle',
    tone: 'warning',
    text: 'A sessão está parada. Inicie para gerar o QR Code e vincular o número da residência.',
  },
  STARTING: {
    label: 'Iniciando',
    icon: 'hourglass_top',
    tone: 'info',
    text: 'A sessão está iniciando. Esta tela atualiza sozinha em alguns segundos.',
  },
  SCAN_QR_CODE: {
    label: 'Aguardando leitura do QR Code',
    icon: 'qr_code_2',
    tone: 'warning',
    text: 'Leia o QR Code com o celular do número da residência para concluir a vinculação.',
  },
  PASSKEY_REQUIRED: {
    label: 'Chave de acesso necessária',
    icon: 'key',
    tone: 'warning',
    text: 'O WhatsApp pede a chave de acesso do aparelho. Conclua o pedido no celular vinculado; esta tela atualiza sozinha.',
  },
  PASSKEY_CONFIRMATION_REQUIRED: {
    label: 'Confirmação da chave de acesso',
    icon: 'key',
    tone: 'warning',
    text: 'O WhatsApp pede a confirmação da chave de acesso. Confirme no celular vinculado; esta tela atualiza sozinha.',
  },
  WORKING: {
    label: 'Conectado',
    icon: 'check_circle',
    tone: 'success',
    text: 'O número está vinculado e as mensagens podem ser enviadas e recebidas.',
  },
  FAILED: {
    label: 'Com falha',
    icon: 'error',
    tone: 'danger',
    text: 'A sessão falhou. Inicie novamente; se o QR Code voltar a aparecer, será preciso ler de novo.',
  },
};
const mediaFailureText = (code: string | null): string =>
  code === 'media_too_large'
    ? 'Arquivo indisponível: passa do limite de 10 MB.'
    : code === 'media_type_not_allowed'
      ? 'Arquivo indisponível: tipo não aceito pelo sistema.'
      : 'Arquivo indisponível: não foi possível baixá-lo.';

const contactName = (conversation: Conversation): string =>
  conversation.guardians[0]?.name ?? (formatPhone(conversation.phone) || 'Número não identificado');
const residentNames = (conversation: Conversation): string =>
  [...new Set(conversation.guardians.map((guardian) => guardian.residentName))].join(', ');
const initials = (conversation: Conversation): string =>
  (conversation.guardians[0]?.name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

/**
 * The thread and the page share one draft guard: without discarding here, leaving the thread would
 * ask twice, once for the child route and once for the parent route.
 */
export const conversationDraftGuard: CanDeactivateFn<unknown> = async () => {
  const forms = inject(UnsavedForms);
  const leave = await forms.canLeave();
  if (leave) forms.discardAll();
  return leave;
};

@Component({
  standalone: true,
  selector: 'sager-conversations',
  imports: [PageHeaderComponent, ReactiveFormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  styleUrls: [
    './conversations-shared.scss',
    './conversations-list.scss',
    './conversations-page.scss',
  ],
  // A lista molda a conversa aninhada (rota própria até 800 px), o que o escopo por componente barraria.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (demo.active()) {
      <main class="page">
        <app-page-header title="Conversas" />
        <section class="op-empty" role="status">
          <h2>Conversas exigem o modo local</h2>
          <p>
            A demonstração não envia nem recebe mensagens reais de WhatsApp. Entre com uma conta do
            modo local para usar esta área.
          </p>
          <a class="btn-secondary" routerLink="/inicio">Voltar ao início</a>
        </section>
      </main>
    } @else {
      <main class="page conv-page" [class.conv-has-thread]="threadOpen()">
        <app-page-header
          class="conv-page-header"
          title="Conversas"
          description="Fale com os responsáveis pelo WhatsApp da residência."
        >
          <a class="btn-secondary" routerLink="/conversas/conexao">
            <span class="material-symbols-rounded" aria-hidden="true">qr_code_2</span>
            Conexão do WhatsApp
          </a>
        </app-page-header>
        <p class="conv-banner conv-health" data-tone="info">
          <span class="material-symbols-rounded" aria-hidden="true">health_and_safety</span>
          <span>
            <strong>Não trate dados de saúde por aqui.</strong> Assuntos de saúde seguem pelo canal
            próprio.
          </span>
        </p>
        @if (unavailableText(); as text) {
          <div class="conv-banner" data-tone="warning" role="status">
            <span class="material-symbols-rounded" aria-hidden="true">link_off</span>
            <span>{{ text }}</span>
            <a routerLink="/conversas/conexao">Ver conexão</a>
          </div>
        }
        @switch (polling.state()) {
          @case ('idle') {
            <div class="conv-banner" data-tone="warning" role="status">
              <span class="material-symbols-rounded" aria-hidden="true">pause_circle</span>
              <span>A atualização automática parou após 30 minutos sem interação.</span>
              <button class="btn-secondary" type="button" (click)="polling.resume()">
                Retomar atualização
              </button>
            </div>
          }
          @case ('expired') {
            <div class="conv-banner" data-tone="danger" role="alert">
              <span class="material-symbols-rounded" aria-hidden="true">lock</span>
              <span>Sua sessão expirou e a atualização automática parou.</span>
              <a routerLink="/acesso">Entrar novamente</a>
            </div>
          }
        }
        @if (stale()) {
          <p class="conv-banner" data-tone="neutral" role="status">
            <span class="material-symbols-rounded" aria-hidden="true">sync_problem</span>
            <span>Não foi possível atualizar agora. Nova tentativa em instantes.</span>
          </p>
        }
        <div class="conv-shell">
          <section class="conv-list" aria-labelledby="conv-list-title">
            <div class="conv-list-head">
              <div class="conv-list-title">
                <h2 id="conv-list-title" tabindex="-1">Conversas recentes</h2>
                <button
                  class="btn conv-new"
                  type="button"
                  [attr.aria-expanded]="starting()"
                  aria-controls="conv-start"
                  (click)="toggleStart()"
                >
                  <span class="material-symbols-rounded" aria-hidden="true">{{
                    starting() ? 'close' : 'add_comment'
                  }}</span>
                  {{ starting() ? 'Fechar' : 'Nova conversa' }}
                </button>
              </div>
              <div id="conv-start">
                @if (starting()) {
                  <div class="conv-start">
                    <label class="field">
                      Responsável cadastrado
                      <input
                        type="search"
                        maxlength="100"
                        autocomplete="off"
                        placeholder="Nome, residente ou telefone"
                        [formControl]="guardianSearch"
                      />
                    </label>
                    <p class="field-hint">
                      Só é possível iniciar com responsável ativo. Nenhuma mensagem é enviada ao
                      abrir a conversa.
                    </p>
                    @if (startError()) {
                      <p class="conv-error" role="alert">{{ startError() }}</p>
                    }
                    <ul class="conv-guardians" aria-label="Responsáveis encontrados">
                      @for (guardian of guardians(); track guardian.id) {
                        <li>
                          <button
                            type="button"
                            [disabled]="!guardian.phone || startBusy()"
                            (click)="start(guardian)"
                          >
                            <strong>{{ guardian.name }}</strong>
                            <span
                              >{{ guardian.relationship }} ·
                              {{ phone(guardian.phone) || 'sem telefone cadastrado' }}</span
                            >
                          </button>
                        </li>
                      } @empty {
                        <li class="field-hint" role="status">Nenhum responsável encontrado.</li>
                      }
                    </ul>
                  </div>
                }
              </div>
              <label class="field conv-search">
                <span class="sr-only">Buscar por nome ou telefone</span>
                <input
                  type="search"
                  maxlength="100"
                  autocomplete="off"
                  placeholder="Buscar por nome ou telefone"
                  [formControl]="search"
                />
              </label>
            </div>
            <div class="conv-rows">
              @if (loading()) {
                <p class="conv-placeholder" role="status">Carregando conversas…</p>
              } @else if (listError()) {
                <div class="conv-placeholder" role="alert">
                  <p>{{ listError() }}</p>
                  <button class="btn-secondary" type="button" (click)="reloadList()">
                    Tentar novamente
                  </button>
                </div>
              } @else {
                <ul>
                  @for (conversation of rows(); track conversation.id) {
                    <li>
                      <a
                        class="conv-row"
                        [routerLink]="['/conversas', conversation.id]"
                        routerLinkActive="active"
                        ariaCurrentWhenActive="page"
                      >
                        <span class="conv-avatar" aria-hidden="true">
                          @if (conversation.linked && initials(conversation)) {
                            {{ initials(conversation) }}
                          } @else {
                            <span class="material-symbols-rounded">person</span>
                          }
                        </span>
                        <span class="conv-row-body">
                          <span class="conv-row-top">
                            <strong>{{ name(conversation) }}</strong>
                            <time [attr.datetime]="conversation.lastMessageAt">{{
                              time(conversation.lastMessageAt)
                            }}</time>
                          </span>
                          @if (conversation.linked) {
                            <span class="conv-row-residents">
                              Responsável por {{ residents(conversation) }}
                            </span>
                          } @else {
                            <span class="status" data-tone="warning">Não vinculada</span>
                          }
                          <span class="conv-row-preview">
                            @if (conversation.lastMessage; as last) {
                              @if (last.kind !== 'TEXT') {
                                <span class="material-symbols-rounded" aria-hidden="true">{{
                                  kinds[last.kind].icon
                                }}</span>
                              }
                              <span class="conv-row-text"
                                >{{ last.direction === 'OUT' ? 'Você: ' : ''
                                }}{{ last.body || kinds[last.kind].label }}</span
                              >
                            } @else {
                              <span class="conv-row-text">Sem mensagens</span>
                            }
                            @if (conversation.unreadCount) {
                              <span class="conv-unread">
                                {{ conversation.unreadCount }}
                                <span class="sr-only">
                                  {{ conversation.unreadCount === 1 ? 'não lida' : 'não lidas' }}
                                </span>
                              </span>
                            }
                          </span>
                        </span>
                      </a>
                    </li>
                  } @empty {
                    <li class="conv-placeholder">
                      {{
                        search.value.trim()
                          ? 'Nenhuma conversa para esta busca.'
                          : 'Nenhuma conversa ainda. Use “Nova conversa” para falar com um responsável.'
                      }}
                    </li>
                  }
                </ul>
                @if (cursor()) {
                  <button
                    class="btn-secondary conv-more"
                    type="button"
                    [disabled]="loadingMore()"
                    (click)="loadMore()"
                  >
                    {{ loadingMore() ? 'Carregando…' : 'Carregar mais conversas' }}
                  </button>
                }
              }
            </div>
          </section>
          <div class="conv-pane">
            @if (!threadOpen()) {
              <div class="conv-pane-empty">
                <span class="material-symbols-rounded" aria-hidden="true">forum</span>
                <h2>Escolha uma conversa</h2>
                <p>As mensagens aparecem aqui, do lado da lista.</p>
              </div>
            }
            <router-outlet (activate)="threadOpen.set(true)" (deactivate)="threadClosed()" />
          </div>
        </div>
      </main>
    }
  `,
})
export class ConversationsPage implements OnDestroy {
  readonly demo = inject(DemoSessionService);
  private readonly api = inject(ConversationsApiService);
  private readonly guardianApi = inject(GuardianApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly search = new FormControl(this.route.snapshot.queryParamMap.get('q') ?? '', {
    nonNullable: true,
  });
  readonly guardianSearch = new FormControl('', { nonNullable: true });
  readonly rows = signal<Conversation[]>([]);
  readonly cursor = signal<string | null>(null);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly listError = signal('');
  readonly stale = signal(false);
  readonly connection = signal<SessionView | null>(null);
  readonly threadOpen = signal(!!this.route.snapshot.firstChild);
  readonly starting = signal(false);
  readonly guardians = signal<GuardianRecord[]>([]);
  readonly startBusy = signal(false);
  readonly startError = signal('');
  readonly unavailableText = computed(() => {
    const reason = this.connection()?.unavailableReason;
    return reason ? unavailableTexts[reason] : '';
  });
  /** Set by the open thread so one timer serves both, at the shorter interval. */
  thread: { refresh(): Promise<void> } | null = null;
  readonly polling = new ConversationPolling(() => this.tick(), THREAD_DELAY_MS);
  readonly kinds = kindLabels;
  readonly name = contactName;
  readonly residents = residentNames;
  readonly initials = initials;
  readonly time = listTime;
  readonly phone = formatPhone;
  private listSequence = 0;
  private guardianSequence = 0;
  private loadedMore = false;
  private lastList = 0;

  constructor() {
    this.search.valueChanges.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => {
      void this.reloadList();
    });
    this.guardianSearch.valueChanges.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => {
      void this.loadGuardians();
    });
    if (this.demo.active()) return;
    void this.reloadList();
    void this.refreshConnection().catch(() => undefined);
    this.polling.start();
  }
  ngOnDestroy(): void {
    this.polling.destroy();
  }
  async reloadList(): Promise<void> {
    this.loading.set(true);
    this.loadedMore = false;
    try {
      await this.refreshList();
    } catch (error) {
      this.listError.set(
        failure(error, 'Não foi possível carregar as conversas. Tente novamente.'),
      );
    } finally {
      this.loading.set(false);
    }
  }
  async refreshList(): Promise<void> {
    const sequence = ++this.listSequence;
    this.lastList = Date.now();
    const page = await this.api.list({ q: this.search.value.trim() });
    if (sequence !== this.listSequence) return;
    const first = new Set(page.items.map((item) => item.id));
    const extra = this.loadedMore ? this.rows().filter((item) => !first.has(item.id)) : [];
    this.rows.set([...page.items, ...extra]);
    if (!this.loadedMore) this.cursor.set(page.nextCursor);
    this.listError.set('');
  }
  async loadMore(): Promise<void> {
    const before = this.cursor();
    if (!before || this.loadingMore()) return;
    this.loadingMore.set(true);
    try {
      const page = await this.api.list({ q: this.search.value.trim(), before });
      const known = new Set(this.rows().map((item) => item.id));
      this.rows.update((rows) => [...rows, ...page.items.filter((item) => !known.has(item.id))]);
      this.cursor.set(page.nextCursor);
      this.loadedMore = true;
    } catch {
      this.stale.set(true);
    } finally {
      this.loadingMore.set(false);
    }
  }
  markedRead(id: string): void {
    this.rows.update((rows) =>
      rows.map((item) => (item.id === id ? { ...item, unreadCount: 0 } : item)),
    );
  }
  threadClosed(): void {
    this.threadOpen.set(false);
    setTimeout(() => document.getElementById('conv-list-title')?.focus(), 0);
  }
  toggleStart(): void {
    this.starting.update((value) => !value);
    this.startError.set('');
    if (this.starting()) void this.loadGuardians();
  }
  async start(guardian: GuardianRecord): Promise<void> {
    if (this.startBusy()) return;
    this.startBusy.set(true);
    this.startError.set('');
    try {
      const conversation = await this.api.start(guardian.id);
      this.starting.set(false);
      this.guardianSearch.setValue('', { emitEvent: false });
      await this.router.navigate(['/conversas', conversation.id]);
      void this.refreshList().catch(() => undefined);
    } catch (error) {
      this.startError.set(
        failure(error, 'Não foi possível abrir a conversa. Nenhuma mensagem foi enviada.'),
      );
    } finally {
      this.startBusy.set(false);
    }
  }
  private async loadGuardians(): Promise<void> {
    const sequence = ++this.guardianSequence;
    try {
      const page = await this.guardianApi.page({
        search: this.guardianSearch.value.trim(),
        active: 'true',
        limit: '10',
        offset: '0',
      });
      if (sequence === this.guardianSequence) this.guardians.set(page.items);
    } catch {
      if (sequence === this.guardianSequence)
        this.startError.set('Não foi possível buscar os responsáveis. Tente novamente.');
    }
  }
  private async refreshConnection(): Promise<void> {
    this.connection.set(await this.api.session());
  }
  private async tick(): Promise<void> {
    const listDue = Date.now() - this.lastList >= LIST_DELAY_MS;
    const results = await Promise.allSettled([
      this.thread?.refresh(),
      ...(listDue ? [this.refreshList(), this.refreshConnection()] : []),
    ]);
    const failures = results.filter((result) => result.status === 'rejected');
    const expired = failures.find((result) => status(result.reason) === 401);
    if (expired) throw expired.reason;
    this.stale.set(failures.length > 0);
  }
}

@Component({
  standalone: true,
  selector: 'sager-conversation-thread',
  imports: [ReactiveFormsModule, RouterLink, UnsavedFormDirective],
  styleUrls: [
    './conversations-shared.scss',
    './conversation-thread.scss',
    './conversation-composer.scss',
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <p class="conv-placeholder" role="status">Carregando mensagens…</p>
    } @else if (missing()) {
      <div class="conv-placeholder" role="alert">
        <h2>Conversa não encontrada</h2>
        <a class="btn-secondary" routerLink="/conversas">Voltar à lista</a>
      </div>
    } @else if (loadError()) {
      <div class="conv-placeholder" role="alert">
        <p>{{ loadError() }}</p>
        <a class="btn-secondary" routerLink="/conversas">Voltar à lista</a>
        <button class="btn-secondary" type="button" (click)="reload()">Tentar novamente</button>
      </div>
    } @else if (conversation(); as current) {
      <header class="conv-thread-head">
        <a class="conv-back" routerLink="/conversas">
          <span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
          Voltar à lista
        </a>
        <div class="conv-thread-title">
          <h2 #title tabindex="-1">{{ name(current) }}</h2>
          <p>
            @if (current.linked) {
              @for (guardian of current.guardians; track guardian.id) {
                <span>{{ guardian.relationship }} de {{ guardian.residentName }}</span>
              }
            } @else {
              <span class="status" data-tone="warning">Número sem cadastro</span>
            }
            @if (current.phone) {
              <span>{{ phone(current.phone) }}</span>
            }
          </p>
        </div>
      </header>
      <div
        #log
        class="conv-log"
        role="log"
        tabindex="0"
        [attr.aria-label]="'Mensagens da conversa com ' + name(current)"
        [attr.aria-busy]="loadingOlder()"
        (scroll)="stick = nearBottom()"
      >
        @if (olderCursor()) {
          <button
            class="btn-secondary conv-older"
            type="button"
            [disabled]="loadingOlder()"
            (click)="loadOlder()"
          >
            {{ loadingOlder() ? 'Carregando…' : 'Carregar mensagens anteriores' }}
          </button>
        }
        @for (group of groups(); track group.day) {
          <p class="conv-day">
            <span>{{ group.day }}</span>
          </p>
          @for (message of group.messages; track message.id) {
            <article class="conv-msg" [class.conv-msg-out]="message.direction === 'OUT'">
              <p class="conv-msg-from">{{ sender(message, current) }}</p>
              @switch (message.mediaState) {
                @case ('PENDING') {
                  <p class="conv-media-note">
                    <span class="material-symbols-rounded" aria-hidden="true">hourglass_top</span>
                    {{ kinds[message.kind].label }} sendo baixado…
                  </p>
                }
                @case ('FAILED') {
                  <p class="conv-media-note" data-tone="danger">
                    <span class="material-symbols-rounded" aria-hidden="true">broken_image</span>
                    {{ mediaFailure(message.mediaFailureCode) }}
                  </p>
                }
                @case ('STORED') {
                  @if (broken().has(message.id)) {
                    <p class="conv-media-note" data-tone="warning">
                      <span class="material-symbols-rounded" aria-hidden="true">warning</span>
                      Não foi possível exibir aqui. Baixe o arquivo para abrir.
                    </p>
                  } @else if (message.kind === 'IMAGE') {
                    <a
                      class="conv-image"
                      target="_blank"
                      rel="noopener"
                      [href]="media(message.id)"
                      [attr.aria-label]="'Abrir foto de ' + sender(message, current)"
                    >
                      <img
                        loading="lazy"
                        [src]="media(message.id)"
                        [alt]="'Foto de ' + sender(message, current)"
                        (load)="keepAtBottom()"
                        (error)="markBroken(message.id)"
                      />
                    </a>
                  } @else if (message.kind === 'AUDIO') {
                    <audio
                      controls
                      preload="none"
                      [src]="media(message.id)"
                      [attr.aria-label]="'Áudio de ' + sender(message, current)"
                      (error)="markBroken(message.id)"
                    ></audio>
                  }
                  @if (message.kind !== 'TEXT') {
                    <a class="conv-download" download [href]="media(message.id)">
                      <span class="material-symbols-rounded" aria-hidden="true">{{
                        message.kind === 'DOCUMENT' ? 'description' : 'download'
                      }}</span>
                      <span>
                        <span class="sr-only">Baixar </span
                        >{{ message.mediaFilename || kinds[message.kind].label }}
                        <small>{{ size(message.mediaSize) }}</small>
                      </span>
                    </a>
                  }
                }
              }
              @if (message.body) {
                <p class="conv-msg-body">{{ message.body }}</p>
              }
              <p class="conv-msg-meta">
                <time [attr.datetime]="message.sentAt">{{ timeOf(message.sentAt) }}</time>
                @if (message.deliveryStatus; as delivery) {
                  <span class="conv-delivery" [attr.data-tone]="deliveries[delivery].tone">
                    <span class="material-symbols-rounded" aria-hidden="true">{{
                      deliveries[delivery].icon
                    }}</span>
                    {{ deliveries[delivery].label }}
                  </span>
                }
              </p>
              @if (message.deliveryStatus === 'FAILED') {
                <p class="conv-msg-note">O WhatsApp recusou o envio desta mensagem.</p>
              }
              @if (message.deliveryStatus === 'UNCERTAIN') {
                <p class="conv-msg-note">Confira no celular antes de repetir o envio.</p>
              }
              @if (message.deliveryStatus === 'FAILED' && message.kind === 'TEXT' && message.body) {
                <button class="conv-inline" type="button" (click)="reuse(message.body)">
                  <span class="material-symbols-rounded" aria-hidden="true">replay</span>
                  Usar o texto de novo
                </button>
              }
              @if (message.linkable) {
                <button
                  class="conv-inline"
                  type="button"
                  [id]="'conv-link-' + message.id"
                  (click)="openLink(message)"
                >
                  <span class="material-symbols-rounded" aria-hidden="true">attach_file_add</span>
                  Vincular a uma saída longa
                </button>
              }
            </article>
          }
        } @empty {
          <p class="conv-placeholder">Nenhuma mensagem nesta conversa ainda.</p>
        }
      </div>
      @if (linkDone(); as done) {
        <div class="conv-banner conv-flush" data-tone="success" role="status">
          <span class="material-symbols-rounded" aria-hidden="true">task_alt</span>
          <span>
            Arquivo vinculado à saída de {{ done.residentName }}. A autorização continua pendente
            até a conferência.
          </span>
          <a [routerLink]="['/saidas/longas', done.id]">Abrir saída</a>
        </div>
      }
      @if (linking(); as message) {
        <section class="conv-link" aria-labelledby="conv-link-title">
          <h3 #linkTitle id="conv-link-title" tabindex="-1">Vincular a uma saída longa</h3>
          <p class="field-hint">
            O arquivo vira candidato da saída escolhida e ainda precisa de conferência. Nada é
            aprovado aqui.
          </p>
          @if (linkError()) {
            <p class="conv-error" role="alert">{{ linkError() }}</p>
          }
          @if (exits(); as options) {
            @if (options.length) {
              <fieldset>
                <legend class="sr-only">Saída longa aberta</legend>
                @for (exit of options; track exit.id) {
                  <label class="conv-radio">
                    <input type="radio" [value]="exit.id" [formControl]="chosenExit" />
                    <span>
                      <strong>{{ exit.residentName }}</strong>
                      <small>
                        Saída {{ when(exit.requestedDepartureAt) }} · retorno
                        {{ when(exit.expectedReturnAt) }}
                      </small>
                    </span>
                  </label>
                }
              </fieldset>
            } @else {
              <p class="conv-placeholder" role="status">
                Este responsável não tem saída longa aberta.
              </p>
            }
          } @else {
            <p class="conv-placeholder" role="status">Carregando saídas abertas…</p>
          }
          <div class="conv-link-actions">
            <button class="btn-secondary" type="button" (click)="closeLink(message.id)">
              Cancelar
            </button>
            @if (exits()?.length) {
              <button class="btn" type="button" [disabled]="linkBusy()" (click)="link(message)">
                {{ linkBusy() ? 'Vinculando…' : 'Vincular arquivo' }}
              </button>
            }
          </div>
        </section>
      }
      <form
        class="conv-composer"
        sagerUnsaved
        [sagerSaving]="sending"
        [formGroup]="form"
        (ngSubmit)="send()"
      >
        @if (blockedText(); as text) {
          <p class="conv-send-blocked" id="conv-send-reason">
            <span class="material-symbols-rounded" aria-hidden="true">block</span>
            {{ text }}
          </p>
        }
        @if (micError()) {
          <p class="conv-error" role="alert">{{ micError() }}</p>
        }
        @if (sendError()) {
          <p class="conv-error" role="alert">{{ sendError() }}</p>
        }
        @if (recording()) {
          <div class="conv-recording" role="group" aria-label="Gravação de áudio">
            <span class="conv-recording-dot" aria-hidden="true"></span>
            <span class="conv-recording-time" role="timer" aria-label="Tempo de gravação">
              Gravando {{ elapsedLabel() }}
            </span>
            <button
              class="conv-tool"
              type="button"
              aria-label="Descartar gravação"
              (click)="cancelRecording()"
            >
              <span class="material-symbols-rounded" aria-hidden="true">delete</span> Descartar
            </button>
            <button
              #stopButton
              class="btn-secondary"
              type="button"
              aria-label="Concluir gravação"
              (click)="stopRecording()"
            >
              <span class="material-symbols-rounded" aria-hidden="true">stop_circle</span> Concluir
            </button>
          </div>
        }
        @if (file(); as attached) {
          <div class="conv-attachment">
            <span class="material-symbols-rounded" aria-hidden="true">{{
              isAudio() ? 'mic' : 'attach_file'
            }}</span>
            <span class="conv-attachment-name">
              {{ attached.name }} <small>{{ size(attached.size) }}</small>
            </span>
            <button
              class="conv-tool conv-icon"
              type="button"
              [attr.aria-label]="'Remover ' + attached.name"
              (click)="clearFile()"
            >
              <span class="material-symbols-rounded" aria-hidden="true">close</span>
            </button>
            @if (preview(); as url) {
              <audio controls [src]="url" aria-label="Prévia do áudio"></audio>
            }
          </div>
        }
        @if (isAudio()) {
          <p class="field-hint">
            O áudio é enviado sem legenda. O texto digitado fica guardado para a próxima mensagem.
          </p>
        } @else {
          <label class="field conv-draft">
            {{ file() ? 'Legenda (opcional)' : 'Mensagem' }}
            <textarea
              #draft
              rows="1"
              formControlName="text"
              [attr.aria-describedby]="blockedText() ? 'conv-send-reason' : null"
            ></textarea>
          </label>
        }
        <div class="conv-composer-actions">
          <input #picker hidden type="file" [attr.accept]="accepted" (change)="pickFile(picker)" />
          <button
            class="conv-tool"
            type="button"
            aria-label="Anexar arquivo"
            (click)="picker.click()"
          >
            <span class="material-symbols-rounded" aria-hidden="true">attach_file</span>
            <span class="conv-tool-label">Anexar</span>
          </button>
          <button
            class="conv-tool"
            type="button"
            aria-label="Gravar áudio"
            [disabled]="recording() || sending()"
            (click)="startRecording()"
          >
            <span class="material-symbols-rounded" aria-hidden="true">mic</span>
            <span class="conv-tool-label">Gravar</span>
          </button>
          <!-- Keeps the focus, and the phone keyboard, in the message field when tapping send. -->
          <button
            class="btn conv-send"
            type="submit"
            [disabled]="sending() || recording() || !!blockedText()"
            (mousedown)="$event.preventDefault()"
          >
            <span class="material-symbols-rounded" aria-hidden="true">send</span>
            {{ sending() ? 'Enviando…' : 'Enviar' }}
          </button>
        </div>
      </form>
    }
  `,
})
export class ConversationThreadComponent implements OnDestroy {
  private readonly api = inject(ConversationsApiService);
  private readonly page = inject(ConversationsPage);
  private readonly injector = inject(Injector);
  private log?: ElementRef<HTMLElement>;
  /** The composer and banners grow under the list; whoever was at the end stays at the end. */
  private readonly resize =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          const log = this.log?.nativeElement;
          if (log && this.stick) log.scrollTop = log.scrollHeight;
        });
  @ViewChild('log') private set logElement(log: ElementRef<HTMLElement> | undefined) {
    this.log = log;
    this.resize?.disconnect();
    if (log) this.resize?.observe(log.nativeElement);
  }
  @ViewChild('title') private title?: ElementRef<HTMLElement>;
  @ViewChild('linkTitle') private linkTitle?: ElementRef<HTMLElement>;
  @ViewChild('draft') private draft?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('stopButton') private stopButton?: ElementRef<HTMLButtonElement>;
  readonly conversation = signal<Conversation | null>(null);
  readonly messages = signal<ConversationMessage[]>([]);
  readonly olderCursor = signal<string | null>(null);
  readonly loading = signal(true);
  readonly loadingOlder = signal(false);
  readonly missing = signal(false);
  readonly loadError = signal('');
  readonly broken = signal(new Set<string>());
  readonly form = new FormGroup({ text: new FormControl('', { nonNullable: true }) });
  readonly sending = signal(false);
  readonly sendError = signal('');
  readonly micError = signal('');
  readonly file = signal<File | null>(null);
  readonly preview = signal<string | null>(null);
  readonly recording = signal(false);
  readonly elapsed = signal(0);
  readonly linking = signal<ConversationMessage | null>(null);
  readonly exits = signal<OpenExit[] | null>(null);
  readonly chosenExit = new FormControl('', { nonNullable: true });
  readonly linkBusy = signal(false);
  readonly linkError = signal('');
  readonly linkDone = signal<{ id: string; residentName: string } | null>(null);
  readonly isAudio = computed(() => !!this.file()?.type.startsWith('audio/'));
  readonly blockedText = computed(() => {
    const reason = this.page.connection()?.unavailableReason;
    return reason ? unavailableTexts[reason] : '';
  });
  readonly elapsedLabel = computed(
    () => `${Math.floor(this.elapsed() / 60)}:${String(this.elapsed() % 60).padStart(2, '0')}`,
  );
  readonly groups = computed(() => {
    const groups: { day: string; messages: ConversationMessage[] }[] = [];
    for (const message of this.messages()) {
      const day = dayLabel(message.sentAt);
      if (groups.at(-1)?.day === day) groups.at(-1)!.messages.push(message);
      else groups.push({ day, messages: [message] });
    }
    return groups;
  });
  readonly kinds = kindLabels;
  readonly deliveries = deliveryLabels;
  readonly accepted = SENDABLE_TYPES;
  readonly name = contactName;
  readonly phone = formatPhone;
  readonly size = formatSize;
  readonly mediaFailure = mediaFailureText;
  readonly when = formatOperationsTime;
  stick = true;
  private id = '';
  private sequence = 0;
  /** One key per logical attempt: a retry of the same content must not create a new message. */
  private idempotencyKey: string | null = null;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private recordingTimer: ReturnType<typeof setInterval> | undefined;
  private chunks: Blob[] = [];
  private keepRecording = false;
  private destroyed = false;

  constructor() {
    this.page.thread = this;
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        this.id = params.get('id') ?? '';
        void this.reload();
      });
    this.form.controls.text.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.idempotencyKey = null;
    });
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.sequence++;
    this.page.thread = null;
    this.resize?.disconnect();
    this.discardRecording();
    this.setPreview(null);
  }
  sender(message: ConversationMessage, conversation: Conversation): string {
    if (message.direction === 'IN') return contactName(conversation);
    if (message.origin === 'AUTHORIZATION') return 'Autorização de saída';
    return message.origin === 'DEVICE' ? 'Enviada pelo celular' : 'Supervisão';
  }
  timeOf(instant: string): string {
    return clock.format(new Date(instant));
  }
  media(id: string): string {
    return this.api.mediaUrl(id);
  }
  markBroken(id: string): void {
    this.broken.update((set) => new Set(set).add(id));
  }
  nearBottom(): boolean {
    const log = this.log?.nativeElement;
    return !log || log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  }
  keepAtBottom(): void {
    if (this.stick) this.scrollToBottom();
  }
  async reload(): Promise<void> {
    const sequence = ++this.sequence;
    this.reset();
    try {
      const [conversation, page] = await Promise.all([
        this.api.get(this.id),
        this.api.messages(this.id),
      ]);
      if (sequence !== this.sequence) return;
      this.conversation.set(conversation);
      this.messages.set(page.items);
      this.olderCursor.set(page.nextCursor);
      this.loading.set(false);
      this.stick = true;
      afterNextRender(
        () => {
          this.scrollToBottom();
          this.title?.nativeElement.focus();
        },
        { injector: this.injector },
      );
      if (conversation.unreadCount > 0) void this.markRead();
    } catch (error) {
      if (sequence !== this.sequence) return;
      this.loading.set(false);
      if (status(error) === 404) this.missing.set(true);
      else
        this.loadError.set(
          failure(error, 'Não foi possível carregar a conversa. Tente novamente.'),
        );
    }
  }
  /** Runs on the shared timer; the failure goes to the page, which handles the expired session. */
  async refresh(): Promise<void> {
    if (!this.conversation()) return;
    const sequence = this.sequence;
    const page = await this.api.messages(this.id);
    if (sequence !== this.sequence) return;
    const known = new Set(this.messages().map((message) => message.id));
    const added = page.items.filter((message) => !known.has(message.id));
    const stuck = this.nearBottom();
    this.merge(page.items);
    // A status that adds a note also grows the list: whoever was at the end stays there.
    if (stuck) this.scrollToBottom();
    if (added.some((message) => message.direction === 'IN')) void this.markRead();
  }
  async loadOlder(): Promise<void> {
    const before = this.olderCursor();
    const log = this.log?.nativeElement;
    if (!before || !log || this.loadingOlder()) return;
    this.loadingOlder.set(true);
    const sequence = this.sequence;
    try {
      const page = await this.api.messages(this.id, before);
      if (sequence !== this.sequence) return;
      const height = log.scrollHeight;
      const top = log.scrollTop;
      this.merge(page.items);
      this.olderCursor.set(page.nextCursor);
      afterNextRender(() => (log.scrollTop = log.scrollHeight - height + top), {
        injector: this.injector,
      });
    } catch (error) {
      this.sendError.set(failure(error, 'Não foi possível carregar as mensagens anteriores.'));
    } finally {
      this.loadingOlder.set(false);
    }
  }
  async send(): Promise<void> {
    if (this.sending() || this.recording() || this.blockedText()) return;
    const file = this.file();
    const audio = this.isAudio();
    const text = this.form.controls.text.value.trim();
    this.sendError.set('');
    if (!file && !text) {
      this.sendError.set('Escreva uma mensagem ou anexe um arquivo.');
      return;
    }
    const limit = file ? MAX_CAPTION : MAX_TEXT;
    if (!audio && [...text].length > limit) {
      this.sendError.set(
        file
          ? `A legenda pode ter até ${MAX_CAPTION.toLocaleString('pt-BR')} caracteres.`
          : `A mensagem pode ter até ${MAX_TEXT.toLocaleString('pt-BR')} caracteres.`,
      );
      return;
    }
    this.idempotencyKey ??= crypto.randomUUID();
    const sequence = this.sequence;
    this.sending.set(true);
    try {
      const message = file
        ? await this.api.sendFile(this.id, file, audio ? '' : text, this.idempotencyKey)
        : await this.api.sendText(this.id, text, this.idempotencyKey);
      if (sequence !== this.sequence) return;
      this.merge([message]);
      this.scrollToBottom();
      this.clearFile();
      if (!audio) this.form.controls.text.setValue('');
      if (!this.form.controls.text.value) this.form.markAsPristine();
      this.idempotencyKey = null;
      void this.page.refreshList().catch(() => undefined);
    } catch (error) {
      if (status(error) === 409) this.idempotencyKey = null;
      this.sendError.set(
        failure(error, 'Não foi possível enviar. O conteúdo continua aqui para tentar de novo.'),
      );
    } finally {
      this.sending.set(false);
      // Without preventScroll the browser scrolls the page to the field and the screen jumps.
      if (!this.destroyed)
        afterNextRender(() => this.draft?.nativeElement.focus({ preventScroll: true }), {
          injector: this.injector,
        });
    }
  }
  reuse(body: string): void {
    const current = this.form.controls.text.value;
    this.form.controls.text.setValue(current ? `${current}\n${body}` : body);
    this.form.markAsDirty();
    this.draft?.nativeElement.focus();
  }
  pickFile(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.sendError.set('');
    this.attach(file);
  }
  clearFile(): void {
    this.file.set(null);
    this.setPreview(null);
    this.idempotencyKey = null;
  }
  async startRecording(): Promise<void> {
    this.micError.set('');
    const type = RECORDING_TYPES.find(
      (candidate) =>
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate),
    );
    if (!type || !navigator.mediaDevices?.getUserMedia) {
      this.micError.set(
        'Este navegador não grava áudio. Anexe um arquivo de áudio; o envio de texto segue disponível.',
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.recording() || this.destroyed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.chunks = [];
      this.keepRecording = false;
      this.recorder = new MediaRecorder(stream, { mimeType: type });
      this.recorder.ondataavailable = (event) => this.chunks.push(event.data);
      this.recorder.onstop = () => this.finishRecording(type);
      this.recorder.start();
      const started = Date.now();
      this.elapsed.set(0);
      this.recordingTimer = setInterval(
        () => this.elapsed.set(Math.floor((Date.now() - started) / 1000)),
        1000,
      );
      this.recording.set(true);
      afterNextRender(() => this.stopButton?.nativeElement.focus(), { injector: this.injector });
    } catch (error) {
      this.stopTracks();
      const name = (error as DOMException).name;
      this.micError.set(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'O navegador negou o acesso ao microfone. Para permitir, abra as permissões do site no ícone ao lado do endereço, libere o microfone e tente de novo. O envio de texto segue disponível.'
          : name === 'NotFoundError'
            ? 'Nenhum microfone foi encontrado neste computador. O envio de texto segue disponível.'
            : 'Não foi possível iniciar a gravação. O envio de texto segue disponível.',
      );
    }
  }
  stopRecording(): void {
    this.keepRecording = true;
    this.endRecorder();
  }
  cancelRecording(): void {
    this.discardRecording();
  }
  openLink(message: ConversationMessage): void {
    this.linking.set(message);
    this.linkDone.set(null);
    this.chosenExit.setValue('');
    afterNextRender(() => this.linkTitle?.nativeElement.focus(), { injector: this.injector });
    void this.loadExits();
  }
  closeLink(messageId: string): void {
    this.linking.set(null);
    this.linkError.set('');
    afterNextRender(() => document.getElementById(`conv-link-${messageId}`)?.focus(), {
      injector: this.injector,
    });
  }
  async link(message: ConversationMessage): Promise<void> {
    const exit = this.exits()?.find((item) => item.id === this.chosenExit.value);
    if (!exit) {
      this.linkError.set('Escolha uma saída longa.');
      return;
    }
    this.linkBusy.set(true);
    this.linkError.set('');
    try {
      const linked = await this.api.link(message.id, exit);
      this.linking.set(null);
      this.linkDone.set({ id: linked.id, residentName: exit.residentName });
      await this.refresh().catch(() => undefined);
    } catch (error) {
      this.linkError.set(failure(error, 'Não foi possível vincular o arquivo. Tente novamente.'));
      // The exit may have changed version, or closed, while the panel was open.
      void this.loadExits();
    } finally {
      this.linkBusy.set(false);
    }
  }
  private async loadExits(): Promise<void> {
    this.exits.set(null);
    try {
      const exits = await this.api.openExits(this.id);
      this.exits.set(exits);
      if (exits.length === 1) this.chosenExit.setValue(exits[0].id);
    } catch (error) {
      this.exits.set([]);
      this.linkError.set(failure(error, 'Não foi possível consultar as saídas abertas.'));
    }
  }
  private async markRead(): Promise<void> {
    const id = this.id;
    try {
      await this.api.markRead(id);
      this.page.markedRead(id);
    } catch {
      // Unread is a hint: the next message tries again.
    }
  }
  private merge(incoming: ConversationMessage[]): void {
    const byId = new Map(this.messages().map((message) => [message.id, message]));
    for (const message of incoming) byId.set(message.id, message);
    this.messages.set(
      [...byId.values()].sort(
        (a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt) || a.id.localeCompare(b.id),
      ),
    );
  }
  private scrollToBottom(): void {
    afterNextRender(
      () => {
        const log = this.log?.nativeElement;
        if (log) log.scrollTop = log.scrollHeight;
        this.stick = true;
      },
      { injector: this.injector },
    );
  }
  private reset(): void {
    this.loading.set(true);
    this.missing.set(false);
    this.loadError.set('');
    this.conversation.set(null);
    this.messages.set([]);
    this.olderCursor.set(null);
    this.broken.set(new Set());
    this.sendError.set('');
    this.micError.set('');
    this.linking.set(null);
    this.linkDone.set(null);
    this.linkError.set('');
    this.discardRecording();
    this.clearFile();
    this.form.reset();
  }
  private attach(file: File): void {
    if (file.size > MAX_FILE_BYTES) {
      this.sendError.set('O arquivo passa do limite de 10 MB.');
      return;
    }
    this.setPreview(file.type.startsWith('audio/') ? URL.createObjectURL(file) : null);
    this.file.set(file);
    this.idempotencyKey = null;
    this.form.markAsDirty();
  }
  private setPreview(url: string | null): void {
    const previous = this.preview();
    if (previous) URL.revokeObjectURL(previous);
    this.preview.set(url);
  }
  private finishRecording(type: string): void {
    this.stopTracks();
    if (!this.keepRecording) return;
    const baseType = type.split(';')[0];
    const blob = new Blob(this.chunks, { type: baseType });
    this.chunks = [];
    if (!blob.size) {
      this.micError.set('A gravação ficou vazia. Tente gravar de novo.');
      return;
    }
    this.sendError.set('');
    this.attach(
      new File([blob], `audio-gravado.${RECORDING_EXTENSIONS[baseType]}`, { type: baseType }),
    );
  }
  private discardRecording(): void {
    this.keepRecording = false;
    this.chunks = [];
    this.endRecorder();
    this.stopTracks();
  }
  private endRecorder(): void {
    clearInterval(this.recordingTimer);
    this.recording.set(false);
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.recorder = null;
  }
  private stopTracks(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}

@Component({
  standalone: true,
  selector: 'sager-conversation-connection',
  imports: [PageHeaderComponent, RouterLink],
  styleUrls: ['./conversations-shared.scss', './conversation-connection.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page conv-connection">
      <a class="conv-back-link" routerLink="/conversas">
        <span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
        Voltar às conversas
      </a>
      <app-page-header
        title="Conexão do WhatsApp"
        description="Situação do número usado pela residência para falar com os responsáveis."
      />
      @if (demo.active()) {
        <section class="op-empty" role="status">
          <h2>Conexão exige o modo local</h2>
          <p>A demonstração não usa WhatsApp e não gera QR Code.</p>
        </section>
      } @else {
        @switch (polling.state()) {
          @case ('idle') {
            <div class="conv-banner" data-tone="warning" role="status">
              <span class="material-symbols-rounded" aria-hidden="true">pause_circle</span>
              <span>A atualização automática parou após 30 minutos sem interação.</span>
              <button class="btn-secondary" type="button" (click)="polling.resume()">
                Retomar atualização
              </button>
            </div>
          }
          @case ('expired') {
            <div class="conv-banner" data-tone="danger" role="alert">
              <span class="material-symbols-rounded" aria-hidden="true">lock</span>
              <span>Sua sessão expirou e a atualização automática parou.</span>
              <a routerLink="/acesso">Entrar novamente</a>
            </div>
          }
        }
        @if (error()) {
          <p class="conv-error" role="alert">{{ error() }}</p>
        }
        @if (session(); as current) {
          @if (current.unavailableReason === 'gateway_unreachable') {
            <p class="conv-banner" data-tone="warning" role="status">
              <span class="material-symbols-rounded" aria-hidden="true">cloud_off</span>
              <span
                >O serviço do WhatsApp não respondeu. A situação abaixo é a última conhecida.</span
              >
            </p>
          }
          <section class="panel conv-session">
            <div role="status">
              <h2>
                <span class="status" [attr.data-tone]="state().tone">
                  <span class="material-symbols-rounded" aria-hidden="true">{{
                    state().icon
                  }}</span>
                  {{ state().label }}
                </span>
              </h2>
              <p>{{ state().text }}</p>
            </div>
            <dl class="conv-session-facts">
              <div>
                <dt>Vinculado em</dt>
                <dd>{{ current.linkedAt ? when(current.linkedAt) : 'Sem registro' }}</dd>
              </div>
              <div>
                <dt>Último evento</dt>
                <dd>{{ current.lastEventAt ? when(current.lastEventAt) : 'Sem registro' }}</dd>
              </div>
              <div>
                <dt>Envio de mensagens</dt>
                <dd>{{ current.canSend ? 'Disponível' : 'Indisponível' }}</dd>
              </div>
            </dl>
            @if (canStart()) {
              <button class="btn" type="button" [disabled]="busy()" (click)="start()">
                <span class="material-symbols-rounded" aria-hidden="true">play_arrow</span>
                {{ busy() ? 'Iniciando…' : 'Iniciar sessão' }}
              </button>
            }
          </section>
          @if (showQr()) {
            <section class="panel conv-qr" aria-labelledby="conv-qr-title">
              <div>
                <h2 id="conv-qr-title">Leia o QR Code</h2>
                <ol>
                  <li>No celular do número da residência, abra o WhatsApp.</li>
                  <li>Toque em <strong>Aparelhos conectados</strong>.</li>
                  <li>Toque em <strong>Conectar um aparelho</strong>.</li>
                  <li>Aponte a câmera para o código ao lado.</li>
                </ol>
                <p class="conv-banner" data-tone="warning">
                  <span class="material-symbols-rounded" aria-hidden="true">warning</span>
                  <span>
                    Quem lê este código passa a controlar a conta. Só leia com o celular da
                    residência. Cada exibição do código fica registrada.
                  </span>
                </p>
              </div>
              <div class="conv-qr-image">
                @if (qrFailed()) {
                  <p role="status">O código ainda não está disponível. Tentando de novo…</p>
                } @else {
                  <img
                    width="264"
                    height="264"
                    alt="QR Code para vincular o WhatsApp da residência"
                    [src]="qrUrl()"
                    (error)="qrFailed.set(true)"
                  />
                }
                <button class="btn-secondary" type="button" (click)="newQr()">
                  <span class="material-symbols-rounded" aria-hidden="true">refresh</span>
                  Gerar novo código
                </button>
              </div>
            </section>
          }
          <p class="field-hint">
            O SAGER não desvincula o número. Para desvincular, use o celular: WhatsApp, Aparelhos
            conectados.
          </p>
        } @else if (!error()) {
          <p class="conv-placeholder" role="status">Consultando a conexão…</p>
        } @else {
          <button class="btn-secondary" type="button" (click)="load()">Tentar novamente</button>
        }
      }
    </main>
  `,
})
export class ConversationConnectionPage implements OnDestroy {
  readonly demo = inject(DemoSessionService);
  private readonly api = inject(ConversationsApiService);
  readonly session = signal<SessionView | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly qrFailed = signal(false);
  private readonly qrRevision = signal(0);
  readonly qrUrl = computed(() => this.api.qrUrl(this.qrRevision()));
  readonly polling = new ConversationPolling(() => this.tick(), THREAD_DELAY_MS);
  readonly state = computed(() => {
    const current = this.session()?.status ?? '';
    return Object.hasOwn(sessionStates, current)
      ? sessionStates[current]
      : {
          label: `Situação não reconhecida (${current})`,
          icon: 'help',
          tone: 'neutral',
          text: 'O serviço informou uma situação que esta tela não conhece. Tente iniciar a sessão ou fale com quem opera o sistema.',
        };
  });
  readonly canStart = computed(() => {
    const current = this.session()?.status;
    return (
      current === 'STOPPED' ||
      current === 'FAILED' ||
      (!!current && !Object.hasOwn(sessionStates, current))
    );
  });
  // Each QR read is audited: fetched only with this screen visible and the session waiting for it.
  readonly showQr = computed(() => {
    const session = this.session();
    return (
      session?.status === 'SCAN_QR_CODE' &&
      session.unavailableReason !== 'gateway_unreachable' &&
      this.polling.state() === 'running'
    );
  });
  readonly when = formatOperationsTime;
  private lastQr = Date.now();

  constructor() {
    if (this.demo.active()) return;
    void this.load();
    this.polling.start();
  }
  ngOnDestroy(): void {
    this.polling.destroy();
  }
  load(): Promise<void> {
    return this.refresh().catch(() => undefined);
  }
  async start(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      this.session.set(await this.api.startSession());
    } catch (error) {
      this.error.set(failure(error, 'Não foi possível iniciar a sessão. Tente novamente.'));
    } finally {
      this.busy.set(false);
    }
  }
  newQr(): void {
    this.qrFailed.set(false);
    this.lastQr = Date.now();
    this.qrRevision.update((value) => value + 1);
  }
  private async refresh(): Promise<void> {
    try {
      this.session.set(await this.api.session());
      this.error.set('');
    } catch (error) {
      this.error.set(failure(error, 'Não foi possível consultar a conexão. Tente novamente.'));
      throw error;
    }
  }
  private async tick(): Promise<void> {
    await this.refresh();
    if (this.showQr() && (this.qrFailed() || Date.now() - this.lastQr >= QR_REFRESH_MS))
      this.newQr();
  }
}
