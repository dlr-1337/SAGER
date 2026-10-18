import { CommunicationFiltersComponent } from './communication-filters.component';
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import {
  CommunicationsApiError,
  CommunicationsLocalApiService,
  communicationsError,
} from './communications-local-api.service';
import { OwnCommunication } from './communications-local.models';
import {
  CommunicationDownloads,
  CommunicationReviewData,
  CommunicationReviewDialogComponent,
  CommunicationReviewResult,
  CommunicationsStateComponent,
} from './communications-local.shared';
import {
  communicationLabels,
  communicationStateLabels,
  formatCommunicationTime,
} from './communications-local.utils';

type OwnTab = 'avisos' | 'advertencias' | 'termos';
@Component({
  standalone: true,
  selector: 'sager-own-communications-local',
  imports: [CommunicationFiltersComponent, RouterLink, CommunicationsStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-page">
      <header class="op-heading">
        <div>
          <a class="op-back" routerLink="/inicio">← Início</a>
          <h1>Minhas comunicações</h1>
          <p>Consulte os avisos, advertências e termos publicados para sua conta.</p>
        </div>
      </header>
      @if (!session.active() && session.hasRole('residente')) {
        <sager-communication-filters mode="own" (changed)="searchFilters = $event; load()" />
      }
      <sager-communications-state
        [demo]="session.active()"
        [blocked]="!session.hasRole('residente')"
        [loading]="loading()"
        [error]="error()"
        (retry)="load()"
      />
      @if (!session.active() && session.hasRole('residente')) {
        <nav class="comm-tabs segmented" aria-label="Tipo de comunicação">
          <button
            type="button"
            [attr.aria-current]="tab() === 'avisos' ? 'page' : null"
            (click)="choose('avisos')"
          >
            Avisos</button
          ><button
            type="button"
            [attr.aria-current]="tab() === 'advertencias' ? 'page' : null"
            (click)="choose('advertencias')"
          >
            Advertências</button
          ><button
            type="button"
            [attr.aria-current]="tab() === 'termos' ? 'page' : null"
            (click)="choose('termos')"
          >
            Termos de reincidência
          </button>
        </nav>
        @if (!loading() && !error()) {
          <section class="op-section">
            <h2>{{ tabLabels[tab()] }}</h2>
            <p class="comm-help">
              Abrir uma comunicação não registra leitura nem ciência. Cada registro tem sua versão e
              evidências próprias.
            </p>
            <div class="op-list">
              @for (item of items(); track item.id) {
                <article class="op-row">
                  <div class="op-row-main">
                    <h3>{{ item.title }}</h3>
                    <p>
                      {{ kinds[item.kind] }} · versão {{ item.contentVersion }} ·
                      {{ formatTime(item.publishedAt) }}
                    </p>
                    @if (item.requiresReview) {
                      <p>Origem ou base em revisão</p>
                    }
                  </div>
                  <div class="op-row-side">
                    <span class="op-status">{{ states[item.status] }}</span
                    ><small>{{
                      item.acknowledgedAt
                        ? 'Ciência registrada nesta versão'
                        : item.readAt
                          ? 'Leitura registrada nesta versão'
                          : 'Sem leitura registrada'
                    }}</small>
                  </div>
                  <a class="op-row-link" [routerLink]="['/minhas-comunicacoes', item.id]"
                    >Ler comunicação<span class="material-symbols-outlined" aria-hidden="true"
                      >arrow_forward</span
                    ></a
                  >
                </article>
              } @empty {
                <div class="op-empty" role="status">
                  <h3>Nenhuma comunicação disponível</h3>
                  <p>As publicações destinadas a sua conta aparecerão nesta categoria.</p>
                </div>
              }
            </div>
            @if (nextCursor() !== null) {
              <div class="comm-actions">
                <button
                  class="btn-secondary"
                  type="button"
                  [disabled]="moreLoading()"
                  (click)="more()"
                >
                  Carregar mais comunicações
                </button>
              </div>
            }
            @if (moreError()) {
              <p class="comm-error" role="alert">{{ moreError() }}</p>
            }
          </section>
        }
      }
    </main>
  `,
  styleUrl: './communications-local.scss',
})
export class OwnCommunicationsLocalPage {
  searchFilters: Record<string, string> = {};
  private appliedSearch: Record<string, string> = {};

  readonly session = inject(DemoSessionService);
  private readonly api = inject(CommunicationsLocalApiService);
  private readonly route = inject(ActivatedRoute);
  readonly tab = signal<OwnTab>(this.initialTab());
  readonly items = signal<OwnCommunication[]>([]);
  readonly nextCursor = signal<number | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly moreLoading = signal(false);
  readonly moreError = signal('');
  readonly kinds = communicationLabels;
  readonly states = communicationStateLabels;
  readonly formatTime = formatCommunicationTime;
  readonly tabLabels = {
    avisos: 'Avisos publicados',
    advertencias: 'Advertências emitidas',
    termos: 'Termos de reincidência emitidos',
  };
  private generation = 0;
  constructor() {
    void this.load();
  }
  private initialTab(): OwnTab {
    const tab = this.route.snapshot.queryParamMap.get('tipo');
    return tab === 'advertencias' || tab === 'termos' ? tab : 'avisos';
  }
  choose(tab: OwnTab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    void this.load();
  }
  async load(): Promise<void> {
    this.appliedSearch = { ...this.searchFilters };
    if (this.session.active() || !this.session.hasRole('residente')) return;
    const generation = ++this.generation;
    this.loading.set(true);
    this.moreLoading.set(false);
    this.error.set('');
    this.moreError.set('');
    this.items.set([]);
    try {
      const page = await this.api.ownList(this.tab(), undefined, this.appliedSearch);
      if (generation === this.generation) {
        this.items.set(page.items);
        this.nextCursor.set(page.nextCursor);
      }
    } catch (error) {
      if (generation === this.generation) this.error.set(communicationsError(error));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  async more(): Promise<void> {
    const cursor = this.nextCursor();
    const generation = this.generation;
    if (cursor === null || this.moreLoading()) return;
    this.moreLoading.set(true);
    this.moreError.set('');
    try {
      const page = await this.api.ownList(this.tab(), cursor, this.appliedSearch);
      if (generation === this.generation) {
        this.items.update((items) => [
          ...items,
          ...page.items.filter((item) => !items.some((old) => old.id === item.id)),
        ]);
        this.nextCursor.set(page.nextCursor);
      }
    } catch (error) {
      if (generation === this.generation) this.moreError.set(communicationsError(error));
    } finally {
      if (generation === this.generation) this.moreLoading.set(false);
    }
  }
}

@Component({
  standalone: true,
  selector: 'sager-own-communication-detail-local',
  imports: [RouterLink, CommunicationsStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-narrow">
      <header class="op-heading">
        <div>
          <a class="op-back" routerLink="/avisos" [queryParams]="{ tipo: backTab() }"
            >← Minhas comunicações</a
          >
          <h1>Comunicação publicada</h1>
          @if (item(); as communication) {
            <p>{{ kinds[communication.kind] }} · versão {{ communication.contentVersion }}</p>
          }
        </div>
      </header>
      <sager-communications-state
        [demo]="session.active()"
        [blocked]="!session.hasRole('residente')"
        [loading]="loading()"
        [error]="loadError()"
        (retry)="load()"
      />
      @if (
        !session.active() && session.hasRole('residente') && !loading() && !loadError() && item();
        as communication
      ) {
        <section class="panel op-panel">
          <h2>{{ communication.title }}</h2>
          <span class="op-status">{{ states[communication.status] }}</span>
          <p class="comm-message">{{ communication.body }}</p>
          @if (communication.stateReason) {
            <dl class="comm-definition">
              <div>
                <dt>Motivo da situação atual</dt>
                <dd>{{ communication.stateReason }}</dd>
              </div>
            </dl>
          }
          @if (communication.requiresReview) {
            <p class="comm-warning" role="status">
              A origem ou a base está em revisão. O conteúdo emitido e sua leitura e ciência
              anteriores permanecem preservados.
            </p>
          }
          <dl class="comm-definition">
            <div>
              <dt>Publicado em</dt>
              <dd>{{ formatTime(communication.publishedAt) }}</dd>
            </div>
            <div>
              <dt>Leitura desta versão</dt>
              <dd>
                {{
                  communication.readAt ? formatTime(communication.readAt) : 'Ainda não registrada'
                }}
              </dd>
            </div>
            <div>
              <dt>Ciência desta versão</dt>
              <dd>
                {{
                  communication.acknowledgedAt
                    ? formatTime(communication.acknowledgedAt)
                    : 'Ainda não registrada'
                }}
              </dd>
            </div>
          </dl>
          @if (communication.status === 'PUBLICADO') {
            <p class="comm-help">
              Leitura e ciência são registros distintos. Ciência confirma que você tomou
              conhecimento desta versão, sem aceitar uma decisão ou assinar outro documento.
            </p>
            <div class="comm-actions">
              @if (!communication.readAt) {
                <button
                  class="btn-secondary"
                  type="button"
                  [disabled]="busy() || conflict()"
                  (click)="read()"
                >
                  Registrar minha leitura
                </button>
              }
              @if (!communication.acknowledgedAt) {
                <button
                  class="btn"
                  type="button"
                  [disabled]="busy() || conflict()"
                  (click)="acknowledge()"
                >
                  Conferir e registrar ciência
                </button>
              }
            </div>
          } @else {
            <p class="comm-help">
              Esta publicação é histórica. A leitura e a ciência anteriores são preservadas; esta
              versão não recebe novos registros.
            </p>
          }
          @if (communication.kind === 'TERMO' && communication.document) {
            <div class="comm-actions">
              <button
                class="btn-secondary"
                type="button"
                [disabled]="downloading() || communication.document.state !== 'STORED'"
                (click)="download()"
              >
                {{ downloading() ? 'Preparando PDF…' : 'Baixar meu termo em PDF' }}
              </button>
            </div>
          }
          @if (error()) {
            <p class="comm-error" role="alert">{{ error() }}</p>
          }
          @if (success()) {
            <p class="comm-success" role="status">{{ success() }}</p>
          }
          <div class="comm-actions">
            <button class="btn-secondary" type="button" [disabled]="busy()" (click)="load()">
              {{ conflict() ? 'Recarregar comunicação' : 'Atualizar dados' }}
            </button>
          </div>
        </section>
      }
    </main>
  `,
  styleUrl: './communications-local.scss',
})
export class OwnCommunicationDetailLocalPage implements OnDestroy {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(CommunicationsLocalApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogs = inject(MatDialog);
  private readonly downloads = new CommunicationDownloads();
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  private alive = true;
  readonly item = signal<OwnCommunication | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly success = signal('');
  readonly busy = signal(false);
  readonly downloading = signal(false);
  readonly conflict = signal(false);
  readonly kinds = communicationLabels;
  readonly states = communicationStateLabels;
  readonly formatTime = formatCommunicationTime;
  constructor() {
    void this.load();
  }
  ngOnDestroy(): void {
    this.alive = false;
    this.downloads.destroy();
  }
  backTab(): OwnTab {
    return this.item()?.kind === 'TERMO'
      ? 'termos'
      : this.item()?.kind === 'ADVERTENCIA'
        ? 'advertencias'
        : 'avisos';
  }
  async load(): Promise<void> {
    if (this.session.active() || !this.session.hasRole('residente') || this.busy()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.success.set('');
    this.conflict.set(false);
    this.item.set(null);
    try {
      this.item.set(await this.api.own(this.id));
    } catch (error) {
      this.loadError.set(communicationsError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async read(): Promise<void> {
    const item = this.item();
    if (!item || item.readAt || !(await this.fresh(item))) return;
    await this.mutate(item, 'leitura');
  }
  async acknowledge(): Promise<void> {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const item = this.item();
    if (!item || item.acknowledgedAt || !(await this.fresh(item))) return;
    this.dialogs
      .open<CommunicationReviewDialogComponent, CommunicationReviewData, CommunicationReviewResult>(
        CommunicationReviewDialogComponent,
        {
          data: {
            title: 'Conferir ciência desta versão',
            action: 'Confirmar minha ciência',
            confirmation: 'Li o conteúdo apresentado e tomei conhecimento desta versão.',
            lines: [
              { label: 'Tipo', value: communicationLabels[item.kind] },
              { label: 'Versão', value: String(item.contentVersion) },
              { label: 'Título', value: item.title },
              { label: 'Conteúdo publicado', value: item.body },
            ],
          },
          width: '650px',
          maxWidth: 'calc(100vw - 32px)',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
        },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) void this.mutate(item, 'ciencia');
        else if (trigger?.isConnected) trigger.focus();
      });
  }
  async download(): Promise<void> {
    const item = this.item();
    if (!item || item.kind !== 'TERMO' || item.document?.state !== 'STORED' || this.downloading())
      return;
    this.downloading.set(true);
    this.error.set('');
    try {
      const blob = await this.api.document(item.sourceId, true);
      if (this.alive) this.downloads.download(blob, item.sourceId);
    } catch (error) {
      this.error.set(communicationsError(error));
    } finally {
      this.downloading.set(false);
    }
  }
  private async fresh(item: OwnCommunication): Promise<boolean> {
    if (
      this.busy() ||
      this.conflict() ||
      this.session.active() ||
      !this.session.hasRole('residente') ||
      item.status !== 'PUBLICADO'
    )
      return false;
    this.busy.set(true);
    this.error.set('');
    try {
      const fresh = await this.api.own(item.id);
      if (
        fresh.contentVersion !== item.contentVersion ||
        fresh.status !== item.status ||
        fresh.title !== item.title ||
        fresh.body !== item.body
      ) {
        this.conflict.set(true);
        this.error.set(
          'A publicação mudou. Recarregue e leia a versão atual antes de registrar sua leitura ou ciência.',
        );
        return false;
      }
      return true;
    } catch (error) {
      this.error.set(communicationsError(error));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
  private async mutate(item: OwnCommunication, action: 'leitura' | 'ciencia'): Promise<void> {
    if (
      this.busy() ||
      this.conflict() ||
      this.session.active() ||
      !this.session.hasRole('residente')
    )
      return;
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    try {
      this.item.set(await this.api.ownAction(item.id, action, item.contentVersion));
      this.success.set(
        action === 'leitura'
          ? 'Leitura desta versão registrada.'
          : 'Ciência desta versão registrada.',
      );
    } catch (error) {
      this.error.set(communicationsError(error));
      if (error instanceof CommunicationsApiError && error.status === 409) this.conflict.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
