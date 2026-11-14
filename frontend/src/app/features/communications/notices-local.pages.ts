import { CommunicationFiltersComponent } from './communication-filters.component';
import { UnsavedFormDirective } from '../../shared/unsaved-form';
import { trimmedLength } from '../../shared/field-rules';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { cursorPages } from '../../core/list-page';
import { PaginationComponent } from '../../shared/pagination.component';
import { ResidentApiService, ResidentRecord } from '../management/resident-api.service';
import {
  CommunicationsApiError,
  CommunicationsLocalApiService,
  communicationsError,
} from './communications-local-api.service';
import { NoticeInput, PublishedNotice } from './communications-local.models';
import {
  CommunicationReviewData,
  CommunicationReviewDialogComponent,
  CommunicationReviewResult,
  CommunicationsStateComponent,
} from './communications-local.shared';
import { CommunicationIntent, formatCommunicationTime } from './communications-local.utils';

function noticeForm() {
  return new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [trimmedLength(3, 200)],
    }),
    body: new FormControl('', {
      nonNullable: true,
      validators: [trimmedLength(3, 4000)],
    }),
  });
}
function noticeContent(form: ReturnType<typeof noticeForm>) {
  const input = form.getRawValue();
  return { title: input.title.trim(), body: input.body.trim() };
}
function noticeInvalid(input: { title: string; body: string }): boolean {
  return (
    input.title.length < 3 ||
    input.title.length > 200 ||
    input.body.length < 3 ||
    input.body.length > 4000
  );
}
const statusLabels = { RASCUNHO: 'Rascunho', PUBLICADO: 'Publicado', RETIRADO: 'Retirado' };

@Component({
  standalone: true,
  selector: 'sager-notices-management-local',
  imports: [
    CommunicationFiltersComponent,
    RouterLink,
    CommunicationsStateComponent,
    PaginationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-page">
      <header class="op-heading">
        <div>
          <a class="op-back" routerLink="/inicio">← Início</a>
          <h1>Avisos aos residentes</h1>
          <p>Escreva e publique avisos para os residentes que você escolher.</p>
        </div>
        @if (!session.active() && session.hasRole('supervisor')) {
          <a class="btn" routerLink="/comunicacoes/avisos/novo">Preparar aviso</a>
        }
      </header>
      <sager-communications-state
        [demo]="session.active()"
        [blocked]="!session.hasRole('supervisor')"
      />
      @if (!session.active() && session.hasRole('supervisor')) {
        <sager-communication-filters
          mode="notices"
          heading="Filtrar avisos"
          (changed)="filter($event)"
        />
        <section class="op-section">
          <h2 id="notice-results-title" tabindex="-1">Avisos registrados</h2>
          <sager-communications-state
            [loading]="list.loading()"
            [error]="list.error()"
            (retry)="list.reload()"
          />
          @if (!list.loading() && !list.error()) {
            <div class="op-list">
              @for (notice of list.items(); track notice.id) {
                <article class="op-row">
                  <div class="op-row-main">
                    <h3>{{ notice.title }}</h3>
                    <p>
                      {{
                        notice.residentIds.length === 1
                          ? '1 residente'
                          : notice.residentIds.length + ' residentes'
                      }}
                    </p>
                    @if (notice.publishedAt) {
                      <p>Publicado em {{ formatTime(notice.publishedAt) }}</p>
                    }
                  </div>
                  <span class="op-status">{{ labels[notice.status] }}</span
                  ><a class="op-row-link" [routerLink]="['/comunicacoes/avisos', notice.id]"
                    >Ver aviso<span class="material-symbols-outlined" aria-hidden="true"
                      >arrow_forward</span
                    ></a
                  >
                </article>
              } @empty {
                <div class="op-empty" role="status">
                  <h3>Nenhum aviso registrado</h3>
                  <p>Escreva um aviso e escolha quem vai receber.</p>
                </div>
              }
            </div>
          }
          <sager-pagination
            [page]="list.page()"
            [hasNext]="list.hasNext()"
            [busy]="list.loading()"
            anchor="notice-results-title"
            (pageChange)="list.go($event)"
          />
        </section>
      }
    </main>
  `,
  styleUrl: './communications-local.scss',
})
export class NoticesManagementLocalPage {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(CommunicationsLocalApiService);
  private filters: Record<string, string> = {};
  readonly list = cursorPages<PublishedNotice>(
    (cursor) => this.api.notices(cursor, this.filters),
    communicationsError,
  );
  readonly labels = statusLabels;
  readonly formatTime = formatCommunicationTime;
  // A primeira carga vem da emissão inicial do painel de filtro.
  filter(filters: Record<string, string>): Promise<void> {
    if (this.session.active() || !this.session.hasRole('supervisor')) return Promise.resolve();
    this.filters = filters;
    return this.list.reload();
  }
}

@Component({
  standalone: true,
  selector: 'sager-notice-form-local',
  imports: [UnsavedFormDirective, RouterLink, ReactiveFormsModule, CommunicationsStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-narrow">
      <header class="op-heading">
        <div>
          <a class="op-back" routerLink="/comunicacoes/avisos">← Avisos</a>
          <h1>Preparar aviso</h1>
          <p>Salve um rascunho e confira o texto antes de publicar.</p>
        </div>
      </header>
      <sager-communications-state
        [demo]="session.active()"
        [blocked]="!session.hasRole('supervisor')"
        [loading]="loading()"
        [error]="loadError()"
        (retry)="load()"
      />
      @if (!session.active() && session.hasRole('supervisor') && !loading() && !loadError()) {
        <form
          sagerUnsaved
          [sagerSaving]="busy"
          class="panel op-panel comm-form"
          [formGroup]="form"
          (ngSubmit)="review()"
          novalidate
        >
          <h2>Conteúdo do aviso</h2>
          <label class="field"
            >Título<input type="text" maxlength="200" formControlName="title" />
            @if (form.controls.title.touched && form.controls.title.invalid) {
              <span class="field-error">Escreva um título de 3 a 200 caracteres.</span>
            }
          </label>
          <label class="field"
            >Mensagem<textarea rows="6" maxlength="4000" formControlName="body"></textarea>
            @if (form.controls.body.touched && form.controls.body.invalid) {
              <span class="field-error">Escreva uma mensagem de 3 a 4.000 caracteres.</span>
            }
          </label>
          <fieldset class="comm-recipient-fieldset">
            <legend>Quem vai receber</legend>
            <label class="field"
              >Buscar residente<input
                type="search"
                data-filter-input
                [formControl]="search"
                placeholder="Nome ou matrícula"
            /></label>
            <div class="comm-recipient-list">
              @for (resident of visibleResidents(); track resident.id) {
                <label class="comm-check"
                  ><input
                    type="checkbox"
                    [checked]="selected().includes(resident.id)"
                    [disabled]="busy()"
                    (change)="toggle(resident.id, $any($event.target).checked)"
                  /><span
                    >{{ resident.name }}<small>Matrícula {{ resident.enrollment }}</small></span
                  ></label
                >
              } @empty {
                <p>Nenhum residente encontrado.</p>
              }
            </div>
            <p>
              {{
                selected().length === 1
                  ? '1 residente escolhido'
                  : selected().length + ' residentes escolhidos'
              }}
            </p>
          </fieldset>
          <p class="comm-help">
            Depois de publicar, você pode corrigir o texto, mas não mudar quem recebe.
          </p>
          @if (error()) {
            <p class="comm-error" role="alert">{{ error() }}</p>
          }
          <div class="comm-actions">
            <a class="btn-secondary" routerLink="/comunicacoes/avisos">Cancelar</a
            ><button class="btn" type="submit" [disabled]="busy() || conflict()">
              Salvar rascunho
            </button>
            @if (conflict()) {
              <button class="btn-secondary" type="button" (click)="load()">Recarregar dados</button>
            }
          </div>
        </form>
      }
    </main>
  `,
  styleUrl: './communications-local.scss',
})
export class NoticeFormLocalPage {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(CommunicationsLocalApiService);
  private readonly registry = inject(ResidentApiService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(MatDialog);
  private readonly intent = new CommunicationIntent();
  readonly form = noticeForm();
  readonly search = new FormControl('', { nonNullable: true });
  readonly searchText = signal('');
  readonly residents = signal<ResidentRecord[]>([]);
  readonly selected = signal<string[]>([]);
  readonly visibleResidents = computed(() => {
    const query = this.searchText().trim().toLocaleLowerCase('pt-BR');
    return this.residents().filter(
      (item) =>
        !query || `${item.name} ${item.enrollment}`.toLocaleLowerCase('pt-BR').includes(query),
    );
  });
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly conflict = signal(false);
  constructor() {
    this.search.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.searchText.set(value));
    void this.load();
  }
  async load(): Promise<void> {
    if (this.session.active() || !this.session.hasRole('supervisor') || this.busy()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.conflict.set(false);
    try {
      this.residents.set(await this.registry.list());
    } catch (error) {
      this.loadError.set(communicationsError(error));
    } finally {
      this.loading.set(false);
    }
  }
  toggle(id: string, checked: boolean): void {
    if (!this.residents().some((item) => item.id === id) || this.busy()) return;
    this.selected.update((items) =>
      checked ? [...items.filter((item) => item !== id), id] : items.filter((item) => item !== id),
    );
  }
  review(): void {
    if (
      this.busy() ||
      this.conflict() ||
      this.session.active() ||
      !this.session.hasRole('supervisor')
    )
      return;
    this.form.markAllAsTouched();
    const input = { ...noticeContent(this.form), residentIds: [...this.selected()].sort() };
    if (
      this.form.invalid ||
      noticeInvalid(input) ||
      !input.residentIds.length ||
      input.residentIds.some((id) => !this.residents().some((item) => item.id === id))
    ) {
      this.error.set(
        'Informe um título de 3 a 200 caracteres, mensagem de 3 a 4.000 e selecione ao menos um residente cadastrado.',
      );
      return;
    }
    this.dialogs
      .open<CommunicationReviewDialogComponent, CommunicationReviewData, CommunicationReviewResult>(
        CommunicationReviewDialogComponent,
        {
          data: {
            title: 'Revisar rascunho do aviso',
            action: 'Salvar rascunho',
            lines: [
              { label: 'Título', value: input.title },
              { label: 'Mensagem', value: input.body },
              {
                label: 'Quem vai receber',
                value: this.residents()
                  .filter((item) => input.residentIds.includes(item.id))
                  .map((item) => `${item.name} · ${item.enrollment}`)
                  .join('\n'),
              },
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
        if (result) void this.save(input);
      });
  }
  private async save(input: NoticeInput): Promise<void> {
    if (this.busy() || this.conflict()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const notice = await this.api.createNotice({
        ...input,
        idempotencyKey: this.intent.for(input),
      });
      this.busy.set(false);
      this.form.markAsPristine();
      await this.router.navigate(['/comunicacoes/avisos', notice.id]);
    } catch (error) {
      this.error.set(communicationsError(error));
      if (error instanceof CommunicationsApiError && error.status === 409) this.conflict.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  standalone: true,
  selector: 'sager-notice-detail-local',
  imports: [UnsavedFormDirective, RouterLink, ReactiveFormsModule, CommunicationsStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-narrow">
      <header class="op-heading">
        <div>
          <a class="op-back" routerLink="/comunicacoes/avisos">← Avisos</a>
          <h1>Aviso</h1>
          @if (item(); as notice) {
            <p>{{ labels[notice.status] }}</p>
          }
        </div>
      </header>
      <sager-communications-state
        [demo]="session.active()"
        [blocked]="!session.hasRole('supervisor')"
        [loading]="loading()"
        [error]="loadError()"
        (retry)="load()"
      />
      @if (
        !session.active() && session.hasRole('supervisor') && !loading() && !loadError() && item();
        as notice
      ) {
        <section class="panel op-panel">
          <h2>{{ notice.title }}</h2>
          <p class="comm-message">{{ notice.body }}</p>
          <h3>Quem recebe</h3>
          <ul>
            @for (id of notice.residentIds; track id) {
              <li>{{ residentLabel(id) }}</li>
            }
          </ul>
          @if (notice.publishedAt) {
            <p>Publicado em {{ formatTime(notice.publishedAt) }}</p>
          }
          @if (notice.withdrawalReason) {
            <dl class="comm-definition">
              <div>
                <dt>Justificativa da retirada</dt>
                <dd>{{ notice.withdrawalReason }}</dd>
              </div>
            </dl>
          }
          <div class="comm-actions">
            @if (notice.status === 'RASCUNHO') {
              <button
                class="btn"
                type="button"
                [disabled]="busy() || conflict()"
                (click)="publish()"
              >
                Revisar publicação
              </button>
            }
            @if (notice.status === 'PUBLICADO') {
              <button
                class="btn-secondary"
                type="button"
                [disabled]="busy() || conflict()"
                (click)="edit.set(!edit())"
              >
                {{ edit() ? 'Fechar correção' : 'Corrigir aviso' }}</button
              ><button
                class="btn-secondary"
                type="button"
                [disabled]="busy() || conflict()"
                (click)="withdraw()"
              >
                Retirar com justificativa
              </button>
            }
          </div>
          @if (edit() && notice.status === 'PUBLICADO') {
            <form
              sagerUnsaved
              [sagerSaving]="busy"
              class="comm-form"
              [formGroup]="form"
              (ngSubmit)="revise()"
              novalidate
            >
              <h3>Corrigir aviso</h3>
              <p class="comm-help">
                As mesmas pessoas recebem o aviso corrigido e precisam ler de novo. O registro do
                texto anterior fica guardado.
              </p>
              <label class="field"
                >Título<input type="text" maxlength="200" formControlName="title" />
                @if (form.controls.title.touched && form.controls.title.invalid) {
                  <span class="field-error">Escreva um título de 3 a 200 caracteres.</span>
                }
              </label>
              <label class="field"
                >Mensagem<textarea rows="6" maxlength="4000" formControlName="body"></textarea>
                @if (form.controls.body.touched && form.controls.body.invalid) {
                  <span class="field-error">Escreva uma mensagem de 3 a 4.000 caracteres.</span>
                }
              </label>
              <button class="btn" type="submit" [disabled]="busy() || conflict()">
                Publicar correção
              </button>
            </form>
          }
          @if (error()) {
            <p class="comm-error" role="alert">{{ error() }}</p>
          }
          @if (success()) {
            <p class="comm-success" role="status">{{ success() }}</p>
          }
          <div class="comm-actions">
            <button class="btn-secondary" type="button" [disabled]="busy()" (click)="load()">
              {{ conflict() ? 'Recarregar dados' : 'Atualizar dados' }}
            </button>
          </div>
        </section>
      }
    </main>
  `,
  styleUrl: './communications-local.scss',
})
export class NoticeDetailLocalPage {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(CommunicationsLocalApiService);
  private readonly registry = inject(ResidentApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogs = inject(MatDialog);
  private readonly intent = new CommunicationIntent();
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly item = signal<PublishedNotice | null>(null);
  readonly residents = signal<ResidentRecord[]>([]);
  readonly form = noticeForm();
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly success = signal('');
  readonly busy = signal(false);
  readonly conflict = signal(false);
  readonly edit = signal(false);
  readonly labels = statusLabels;
  readonly formatTime = formatCommunicationTime;
  constructor() {
    void this.load();
  }
  residentLabel(id: string): string {
    const resident = this.residents().find((item) => item.id === id);
    return resident ? `${resident.name} · ${resident.enrollment}` : 'Cadastro vinculado ' + id;
  }
  async load(): Promise<void> {
    if (this.session.active() || !this.session.hasRole('supervisor') || this.busy()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.success.set('');
    this.conflict.set(false);
    this.edit.set(false);
    this.item.set(null);
    try {
      const [item, residents] = await Promise.all([this.api.notice(this.id), this.registry.list()]);
      this.item.set(item);
      this.residents.set(residents);
      this.form.reset({ title: item.title, body: item.body });
    } catch (error) {
      this.loadError.set(communicationsError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async publish(): Promise<void> {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const item = this.item();
    if (!item || item.status !== 'RASCUNHO' || !(await this.fresh(item))) return;
    this.review(
      {
        title: 'Revisar publicação do aviso',
        action: 'Confirmar publicação',
        warning:
          'O conteúdo será publicado para os destinatários vinculados. Leitura e ciência serão registradas por ações próprias do residente.',
        lines: this.summary(item),
      },
      () =>
        this.mutate(async () => {
          const input = { version: item.version };
          this.item.set(
            await this.api.publishNotice(item.id, item.version, this.intent.for(input)),
          );
        }, 'Aviso publicado para os destinatários selecionados.'),
      trigger,
    );
  }
  async revise(): Promise<void> {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const item = this.item();
    if (!item || item.status !== 'PUBLICADO') return;
    this.form.markAllAsTouched();
    const input = noticeContent(this.form);
    if (this.form.invalid || noticeInvalid(input)) {
      this.error.set('Revise o título de 3 a 200 caracteres e a mensagem de 3 a 4.000.');
      return;
    }
    if (!(await this.fresh(item))) return;
    this.review(
      {
        title: 'Conferir correção do aviso',
        action: 'Publicar correção',
        warning:
          'As mesmas pessoas recebem o aviso corrigido. O registro do texto anterior fica guardado.',
        lines: this.summary({ ...item, ...input }),
      },
      () =>
        this.mutate(async () => {
          const payload = { ...input, version: item.version };
          this.item.set(
            await this.api.reviseNotice(item.id, {
              ...payload,
              idempotencyKey: this.intent.for(payload),
            }),
          );
          this.edit.set(false);
        }, 'Correção publicada.'),
      trigger,
    );
  }
  withdraw(): void {
    const item = this.item();
    if (!item || item.status !== 'PUBLICADO' || this.busy() || this.conflict()) return;
    this.review(
      {
        title: 'Revisar retirada do aviso',
        action: 'Confirmar retirada',
        requireReason: true,
        warning:
          'A retirada preserva o conteúdo publicado e a leitura e ciência anteriores. O residente verá a situação atual.',
        lines: this.summary(item),
      },
      (result) =>
        this.mutate(async () => {
          this.item.set(await this.api.withdrawNotice(item.id, item.version, result.reason));
          this.edit.set(false);
        }, 'Aviso retirado com justificativa. Histórico preservado.'),
    );
  }
  private summary(item: PublishedNotice) {
    return [
      { label: 'Título', value: item.title },
      { label: 'Mensagem', value: item.body },
      {
        label: 'Quem vai receber',
        value: item.residentIds.map((id) => this.residentLabel(id)).join('\n'),
      },
    ];
  }
  private async fresh(item: PublishedNotice): Promise<boolean> {
    if (
      this.busy() ||
      this.conflict() ||
      this.session.active() ||
      !this.session.hasRole('supervisor')
    )
      return false;
    this.busy.set(true);
    this.error.set('');
    try {
      const fresh = await this.api.notice(item.id);
      if (fresh.version !== item.version || fresh.status !== item.status) {
        this.conflict.set(true);
        this.error.set(
          'O aviso mudou. Recarregue o conteúdo e os destinatários antes de confirmar.',
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
  private review(
    data: CommunicationReviewData,
    action: (result: CommunicationReviewResult) => unknown,
    trigger: HTMLElement | null = null,
  ): void {
    this.dialogs
      .open<CommunicationReviewDialogComponent, CommunicationReviewData, CommunicationReviewResult>(
        CommunicationReviewDialogComponent,
        {
          data,
          width: '650px',
          maxWidth: 'calc(100vw - 32px)',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
        },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) void action(result);
        else if (trigger?.isConnected) trigger.focus();
      });
  }
  private async mutate(action: () => Promise<void>, success: string): Promise<void> {
    if (
      this.busy() ||
      this.conflict() ||
      this.session.active() ||
      !this.session.hasRole('supervisor')
    )
      return;
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await action();
      this.success.set(success);
    } catch (error) {
      this.error.set(communicationsError(error));
      if (error instanceof CommunicationsApiError && error.status === 409) this.conflict.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
