import { CommunicationFiltersComponent } from './communication-filters.component';
import { UnsavedFormDirective } from '../../shared/unsaved-form';
import { trimmedLength } from '../../shared/field-rules';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { autoRefresh } from '../../core/auto-refresh';
import { DemoSessionService } from '../../core/demo-session.service';
import { cursorPages } from '../../core/list-page';
import { AutoRefreshStatusComponent } from '../../shared/auto-refresh-status.component';
import { PaginationComponent } from '../../shared/pagination.component';
import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { StatusLegendComponent } from '../../shared/status-legend.component';
import { toneAttr } from '../../shared/status-tones';
import { HousingMap, RoomRecord, roomOptionLabel, roomsIn } from '../management/housing.models';
import { ResidentApiService, ResidentRecord } from '../management/resident-api.service';
import { RoomApiService } from '../management/room-api.service';
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
import {
  CommunicationIntent,
  formatCommunicationTime,
  noticeStatusLabels,
} from './communications-local.utils';

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

export type NoticeAudience = 'TODOS' | 'ALOJAMENTO' | 'QUARTO' | 'MAIORES' | 'MENORES' | 'ESCOLHER';
export const audienceLabels: Record<NoticeAudience, string> = {
  TODOS: 'Todos os moradores',
  ALOJAMENTO: 'Um alojamento',
  QUARTO: 'Um quarto',
  MAIORES: 'Só maiores de 18',
  MENORES: 'Só menores de 18',
  ESCOLHER: 'Escolher pessoas',
};

/**
 * Filtros de `GET /api/v1/residentes` de cada opção de "Quem recebe?" (notice-audience-options,
 * design D2). A idade vem de `minor`, que o servidor calcula na data civil de America/Sao_Paulo;
 * quem não tem data de nascimento fica fora das opções por idade. Devolve null quando a opção não
 * é uma busca ("Escolher pessoas") ou falta o alojamento ou o quarto.
 */
export function audienceQuery(
  audience: NoticeAudience | '',
  place: { accommodationId?: string; roomId?: string } = {},
): { params: Record<string, string>; keep: (resident: ResidentRecord) => boolean } | null {
  const everyone = () => true;
  if (audience === 'TODOS') return { params: { allocated: 'true' }, keep: everyone };
  if (audience === 'ALOJAMENTO')
    return place.accommodationId
      ? { params: { accommodationId: place.accommodationId }, keep: everyone }
      : null;
  if (audience === 'QUARTO')
    return place.roomId ? { params: { roomId: place.roomId }, keep: everyone } : null;
  if (audience === 'MAIORES' || audience === 'MENORES') {
    const minor = audience === 'MENORES';
    return {
      params: { allocated: 'true' },
      keep: (resident) => !!resident.birthDate && resident.minor === minor,
    };
  }
  return null;
}
const residentsCount = (count: number) => (count === 1 ? '1 residente' : `${count} residentes`);

@Component({
  standalone: true,
  selector: 'sager-notices-management-local',
  imports: [
    AutoRefreshStatusComponent,
    CommunicationFiltersComponent,
    RouterLink,
    CommunicationsStateComponent,
    PaginationComponent,
    StatusLegendComponent,
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
        <sager-auto-refresh-status [refresh]="refresh" />
        <sager-communication-filters
          mode="notices"
          heading="Filtrar avisos"
          (changed)="filter($event)"
        />
        <section class="op-section">
          <h2 id="notice-results-title" tabindex="-1">Avisos registrados</h2>
          <sager-status-legend [names]="legendNames" />
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
                    <p>{{ count(notice.residentIds.length) }}</p>
                    @if (notice.publishedAt) {
                      <p>Publicado em {{ formatTime(notice.publishedAt) }}</p>
                    }
                  </div>
                  <span class="status" [attr.data-tone]="tone(labels[notice.status])">{{
                    labels[notice.status]
                  }}</span
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
  readonly refresh = autoRefresh(() => this.list.refresh());
  readonly labels = noticeStatusLabels;
  readonly legendNames = Object.values(noticeStatusLabels);
  readonly tone = toneAttr;
  readonly count = residentsCount;
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
  imports: [
    UnsavedFormDirective,
    RouterLink,
    ReactiveFormsModule,
    CommunicationsStateComponent,
    SearchableSelectDirective,
  ],
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
            <legend>Quem recebe?</legend>
            @for (option of audiences; track option[0]) {
              <label class="comm-check"
                ><input
                  type="radio"
                  name="notice-audience"
                  [value]="option[0]"
                  [formControl]="audience"
                /><span>{{ option[1] }}</span></label
              >
            }
            @if (chosen() === 'ALOJAMENTO' || chosen() === 'QUARTO') {
              <label class="field"
                >Alojamento<select sagerSearchable [formControl]="accommodationId">
                  <option value="">Escolha o alojamento</option>
                  @for (item of housing().accommodations; track item.id) {
                    <option [value]="item.id">{{ item.name }}</option>
                  }
                </select></label
              >
            }
            @if (chosen() === 'QUARTO' && accommodation()) {
              <label class="field"
                >Quarto<select sagerSearchable [formControl]="roomId">
                  <option value="">Escolha o quarto</option>
                  @for (room of rooms(); track room.id) {
                    <option [value]="room.id">{{ roomLabel(room) }}</option>
                  }
                </select></label
              >
            }
            @if (chosen() === 'ESCOLHER') {
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
            }
            @if (resolving()) {
              <p role="status">Buscando quem vai receber…</p>
            } @else if (resolveError()) {
              <p class="comm-error" role="alert">{{ resolveError() }}</p>
            } @else if (countText()) {
              <p class="comm-count" role="status">{{ countText() }}</p>
            }
            @if (chosen() !== 'ESCOLHER' && candidates().length) {
              <details class="more-details">
                <summary>Ver quem vai receber</summary>
                <div class="comm-recipient-list">
                  @for (resident of candidates(); track resident.id) {
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
                  }
                </div>
              </details>
            }
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
  private readonly roomApi = inject(RoomApiService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(MatDialog);
  private readonly intent = new CommunicationIntent();
  readonly form = noticeForm();
  readonly audiences = Object.entries(audienceLabels) as [NoticeAudience, string][];
  readonly audience = new FormControl<NoticeAudience | ''>('', { nonNullable: true });
  readonly accommodationId = new FormControl('', { nonNullable: true });
  readonly roomId = new FormControl('', { nonNullable: true });
  readonly chosen = signal<NoticeAudience | ''>('');
  readonly accommodation = signal('');
  readonly housing = signal<HousingMap>({ accommodations: [], units: [], rooms: [] });
  readonly rooms = computed(() => roomsIn(this.housing(), this.accommodation()));
  readonly search = new FormControl('', { nonNullable: true });
  readonly searchText = signal('');
  readonly residents = signal<ResidentRecord[]>([]);
  /** Residentes que a opção escolhida trouxe; a lista fica fixa no rascunho (design D3). */
  readonly candidates = signal<ResidentRecord[]>([]);
  readonly selected = signal<string[]>([]);
  readonly resolving = signal(false);
  readonly resolved = signal(false);
  readonly resolveError = signal('');
  private readonly known = computed(
    () => new Map([...this.residents(), ...this.candidates()].map((item) => [item.id, item])),
  );
  readonly visibleResidents = computed(() => {
    const query = this.searchText().trim().toLocaleLowerCase('pt-BR');
    return this.residents().filter(
      (item) =>
        !query || `${item.name} ${item.enrollment}`.toLocaleLowerCase('pt-BR').includes(query),
    );
  });
  readonly countText = computed(() => {
    const audience = this.chosen();
    if (!audience || (audience !== 'ESCOLHER' && !this.resolved())) return '';
    if (audience !== 'ESCOLHER' && !this.candidates().length)
      return 'Ninguém recebe com essa opção.';
    const count = this.selected().length;
    return count === 1 ? '1 residente vai receber' : `${count} residentes vão receber`;
  });
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly conflict = signal(false);
  private pending?: AbortController;
  constructor() {
    this.search.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.searchText.set(value));
    this.audience.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.chosen.set(value);
      void this.resolve();
    });
    this.accommodationId.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.accommodation.set(value);
      this.roomId.setValue('', { emitEvent: false });
      void this.resolve();
    });
    this.roomId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => void this.resolve());
    void this.load();
  }
  async load(): Promise<void> {
    if (this.session.active() || !this.session.hasRole('supervisor') || this.busy()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.conflict.set(false);
    try {
      const [residents, housing] = await Promise.all([this.registry.list(), this.roomApi.map()]);
      this.residents.set(residents);
      this.housing.set(housing);
    } catch (error) {
      this.loadError.set(communicationsError(error));
    } finally {
      this.loading.set(false);
    }
  }
  roomLabel(room: RoomRecord): string {
    return roomOptionLabel(room, this.housing().units);
  }
  /** Refaz a lista da opção: só a última busca vale, e as desmarcações anteriores saem (D4, D6). */
  async resolve(): Promise<void> {
    this.pending?.abort();
    this.pending = undefined;
    this.candidates.set([]);
    this.selected.set([]);
    this.resolved.set(false);
    this.resolveError.set('');
    this.resolving.set(false);
    const query = audienceQuery(this.chosen(), {
      accommodationId: this.accommodationId.value,
      roomId: this.roomId.value,
    });
    if (!query) return;
    const pending = (this.pending = new AbortController());
    this.resolving.set(true);
    try {
      const { items } = await this.registry.page(query.params, pending.signal);
      if (pending.signal.aborted) return;
      const chosen = items.filter(query.keep);
      this.candidates.set(chosen);
      this.selected.set(chosen.map((item) => item.id));
      this.resolved.set(true);
    } catch (error) {
      if (!pending.signal.aborted) this.resolveError.set(communicationsError(error));
    } finally {
      if (this.pending === pending) this.resolving.set(false);
    }
  }
  toggle(id: string, checked: boolean): void {
    if (!this.known().has(id) || this.busy()) return;
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
      input.residentIds.some((id) => !this.known().has(id))
    ) {
      this.error.set(
        'Informe um título de 3 a 200 caracteres, mensagem de 3 a 4.000 e escolha quem recebe.',
      );
      return;
    }
    this.error.set('');
    const names = [...this.known().values()]
      .filter((item) => input.residentIds.includes(item.id))
      .map((item) => `${item.name} · ${item.enrollment}`);
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
                value: [
                  `${this.criterion()} · ${residentsCount(input.residentIds.length)}`,
                  ...names,
                ].join('\n'),
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
  /** A opção como aparece na revisão (design D8): o nome da opção e, se houver, o lugar. */
  private criterion(): string {
    const audience = this.chosen();
    const map = this.housing();
    if (audience === 'ALOJAMENTO')
      return `${audienceLabels.ALOJAMENTO}: ${map.accommodations.find((item) => item.id === this.accommodationId.value)?.name ?? ''}`;
    if (audience === 'QUARTO') {
      const room = map.rooms.find((item) => item.id === this.roomId.value);
      return `${audienceLabels.QUARTO}: ${room ? this.roomLabel(room) : ''}`;
    }
    return audience === 'ESCOLHER'
      ? 'Escolhidos um a um'
      : audience
        ? audienceLabels[audience]
        : '';
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
  imports: [
    AutoRefreshStatusComponent,
    StatusLegendComponent,
    UnsavedFormDirective,
    RouterLink,
    ReactiveFormsModule,
    CommunicationsStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-narrow">
      <header class="op-heading">
        <div>
          <a class="op-back" routerLink="/comunicacoes/avisos">← Avisos</a>
          <h1>Aviso</h1>
        </div>
        @if (item(); as notice) {
          <span class="status" [attr.data-tone]="tone(labels[notice.status])">{{
            labels[notice.status]
          }}</span>
        }
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
        <sager-auto-refresh-status [refresh]="refresh" />
        <sager-status-legend [names]="legendNames" />
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
              <p class="comm-help">As mesmas pessoas recebem a correção e leem de novo.</p>
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
          @if (conflict()) {
            <div class="comm-actions">
              <button class="btn-secondary" type="button" [disabled]="busy()" (click)="load()">
                Recarregar dados
              </button>
            </div>
          }
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
  readonly labels = noticeStatusLabels;
  readonly legendNames = Object.values(noticeStatusLabels);
  readonly tone = toneAttr;
  readonly formatTime = formatCommunicationTime;
  private sequence = 0;
  readonly refresh = autoRefresh(() => this.load(true), {
    busy: () => this.busy() || this.conflict() || this.loading(),
  });
  constructor() {
    void this.load();
  }
  residentLabel(id: string): string {
    const resident = this.residents().find((item) => item.id === id);
    return resident ? `${resident.name} · ${resident.enrollment}` : 'Cadastro vinculado ' + id;
  }
  /** `silent` é a atualização automática: mantém mensagens, correção aberta e foco, e lança a falha. */
  async load(silent = false): Promise<void> {
    if (this.session.active() || !this.session.hasRole('supervisor') || this.busy()) return;
    const sequence = ++this.sequence;
    if (!silent) {
      this.loading.set(true);
      this.loadError.set('');
      this.error.set('');
      this.success.set('');
      this.conflict.set(false);
      this.edit.set(false);
      this.item.set(null);
    }
    try {
      const [item, residents] = await Promise.all([this.api.notice(this.id), this.registry.list()]);
      if (sequence !== this.sequence) return;
      this.item.set(item);
      this.residents.set(residents);
      if (!silent || !this.form.dirty) this.form.reset({ title: item.title, body: item.body });
    } catch (error) {
      if (silent) throw error;
      if (sequence === this.sequence) this.loadError.set(communicationsError(error));
    } finally {
      if (!silent && sequence === this.sequence) this.loading.set(false);
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
        warning: 'Os residentes escolhidos passam a ver o aviso.',
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
        warning: 'As mesmas pessoas recebem a correção, e o texto anterior fica guardado.',
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
          this.form.markAsPristine();
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
        warning: 'O aviso deixa de valer, e a leitura e a ciência anteriores ficam guardadas.',
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
    // Uma atualização automática em andamento traria a versão anterior por cima da gravação.
    this.sequence++;
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
