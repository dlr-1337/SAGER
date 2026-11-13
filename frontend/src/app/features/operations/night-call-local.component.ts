import { normalizeSearch } from '../../shared/search';
import { rememberFilters } from '../../core/filter-state';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { ProgressBarComponent } from '../../shared/progress-bar.component';
import { FilterChip, FilterPanelComponent } from '../../shared/filter-panel.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { HousingMap, roomOptionLabel } from '../management/housing.models';
import { RoomApiService } from '../management/room-api.service';
import {
  OperationsApiError,
  OperationsLocalApiService,
  operationsError,
} from './operations-local-api.service';
import { CallContext, CallMark, CallResident, NightCall } from './operations-local.models';
import { callMarkLabels, formatCivilDate, formatOperationsTime } from './operations-local.utils';
import {
  LocalOperationsReviewDialogComponent,
  LocalReviewData,
  LocalReviewResult,
} from './review-dialog-local.component';

@Component({
  standalone: true,
  selector: 'app-night-call-local',
  imports: [
    SearchableSelectDirective,
    ProgressBarComponent,
    ReactiveFormsModule,
    RouterLink,
    FilterPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page">
      <header class="op-heading">
        <div>
          <a routerLink="/inicio" class="op-back">← Início</a>
          <h1>Chamada noturna</h1>
          <p>Marque quem está presente hoje à noite.</p>
        </div>
      </header>
      @if (!session.hasRole('supervisor')) {
        <section class="op-empty" role="alert">
          <h2>Acesso restrito</h2>
          <p>A chamada é registrada pelo supervisor.</p>
        </section>
      } @else {
        @if (context(); as ctx) {
          <section class="panel op-panel" aria-labelledby="call-selection">
            <h2 id="call-selection">Alojamento e data</h2>
            <div class="op-filters">
              <label class="field"
                >Alojamento<select
                  sagerSearchable
                  [formControl]="accommodation"
                  (change)="clearRoomFilters(); load()"
                >
                  @for (option of ctx.accommodations; track option.id) {
                    <option [value]="option.id">{{ option.name }}</option>
                  }
                </select></label
              ><label class="field"
                >Data da chamada<input
                  type="date"
                  [formControl]="date"
                  [max]="ctx.referenceDate" /></label
              ><button
                type="button"
                class="btn op-secondary"
                [disabled]="loading() || busy()"
                (click)="load()"
              >
                Ver chamada
              </button>
            </div>
            <p class="op-help">Horário da chamada: 22h às 23h30.</p>
          </section>
        }
        @if (loading()) {
          <div class="op-state" role="status">
            <h2>Carregando chamada</h2>
            <p>Aguarde um momento.</p>
          </div>
        } @else if (loadError()) {
          <div class="op-state" role="alert">
            <h2>Não foi possível carregar a chamada</h2>
            <p>{{ loadError() }}</p>
            <button type="button" class="btn op-secondary" (click)="load()">
              Tentar novamente
            </button>
          </div>
        } @else if (context(); as ctx) {
          @if (!ctx.accommodations.length) {
            <div class="op-empty" role="status">
              <h2>Nenhum alojamento cadastrado</h2>
              <p>Cadastre o alojamento e coloque os residentes nos quartos antes da chamada.</p>
            </div>
          } @else if (call(); as current) {
            <section class="panel op-panel" aria-labelledby="call-summary">
              <div class="op-section-heading">
                <h2 id="call-summary">
                  {{ current.accommodationName }} · {{ formatDate(current.referenceDate) }}
                </h2>
                <span class="op-status">{{
                  current.status === 'ABERTA' ? 'Aberta' : 'Fechada'
                }}</span>
              </div>
              <dl class="op-call-summary">
                <div>
                  <dt>Marcações</dt>
                  <dd>
                    {{ current.summary.total - current.summary.unmarked }} de
                    {{ current.summary.total }}
                  </dd>
                </div>
                <div>
                  <dt>Presentes</dt>
                  <dd>{{ current.summary.present }}</dd>
                </div>
                <div>
                  <dt>Ausentes</dt>
                  <dd>{{ current.summary.absent }}</dd>
                </div>
                <div>
                  <dt>Justificadas</dt>
                  <dd>{{ current.summary.justified }}</dd>
                </div>
              </dl>
              <sager-progress-bar
                [done]="current.summary.total - current.summary.unmarked"
                [total]="current.summary.total"
                noun="marcações registradas"
              />
              <p class="op-help">Aberta em {{ formatTime(current.openedAt) }}.</p>
              @if (current.status === 'ABERTA' && current.summary.justified) {
                <p class="op-warning">
                  Residentes com saída em andamento já entram como ausência justificada. Confira e
                  corrija se preciso.
                </p>
              }
              @if (current.outsideWindowConfirmed) {
                <p class="op-warning">Aberta fora do horário: {{ current.justification }}</p>
              }
              @if (current.closedAt) {
                <p class="op-success" role="status">
                  Fechada em {{ formatTime(current.closedAt) }}.
                </p>
              }
              @if (current.closeOutsideWindowConfirmed) {
                <p class="op-warning">Fechada fora do horário: {{ current.closeJustification }}</p>
              }
            </section>
            <section class="op-section" aria-labelledby="call-roster">
              <div class="op-section-heading"><h2 id="call-roster">Residentes da chamada</h2></div>
              <sager-filter-panel
                heading="Filtrar residentes"
                key="night-call"
                [chips]="chips()"
                (remove)="removeFilter($event)"
                (clear)="clearFilters()"
              >
                <label filterMain class="field"
                  >Buscar por nome ou matrícula<input
                    type="search"
                    [formControl]="search"
                    (input)="searchValue.set(search.value)"
                /></label>
                <div class="op-filters">
                  <label class="field"
                    >Marcação<select
                      [value]="markFilter()"
                      (change)="markFilter.set($any($event.target).value)"
                    >
                      <option value="">Todas</option>
                      <option value="PENDENTE">Pendente</option>
                      <option value="PRESENTE">Presente</option>
                      <option value="AUSENTE">Ausente</option>
                      <option value="AUSENCIA_JUSTIFICADA">Ausência justificada</option>
                    </select></label
                  >
                  @if (unitOptions().length) {
                    <label class="field"
                      >Casa ou bloco<select sagerSearchable [formControl]="unit">
                        <option value="">Todos os blocos</option>
                        @for (option of unitOptions(); track option.id) {
                          <option [value]="option.id">{{ option.name }}</option>
                        }
                      </select></label
                    >
                  }
                  <label class="field"
                    >Quarto<select sagerSearchable [formControl]="room">
                      <option value="">Todos os quartos</option>
                      @for (option of roomOptions(); track option.id) {
                        <option [value]="option.id">{{ option.label }}</option>
                      }
                    </select></label
                  >
                </div>
              </sager-filter-panel>
              @if (optionsError()) {
                <p class="op-help">{{ optionsError() }}</p>
              }
              <p role="status">
                {{ filtered().length }} de {{ current.records.length }} residentes
              </p>
              @if (!current.records.length) {
                <div class="op-empty" role="status"><h3>Nenhum residente nesta chamada</h3></div>
              } @else if (!filtered().length) {
                <div class="op-empty" role="status">
                  <h3>Nenhum residente encontrado</h3>
                  <p>Altere os filtros para consultar as demais marcações.</p>
                </div>
              } @else {
                <div class="op-list">
                  @for (row of filtered(); track row.residentId) {
                    <article class="op-row op-call-row">
                      <div class="op-row-main">
                        <h3>{{ row.residentName }}</h3>
                        <p>Matrícula {{ row.enrollment }} · {{ roomOf(row) }}</p>
                        @if (row.authorizedExits.length) {
                          <span class="op-inline-note">Está fora com saída autorizada</span>
                        }
                        @if (row.mark) {
                          <p>
                            {{ labels[row.mark] }}
                            @if (row.authorizedExitId) {
                              ·
                              <a
                                class="op-exit-link"
                                [routerLink]="[
                                  row.authorizedExitType === 'LONG' ? '/saidas/longas' : '/saidas',
                                  row.authorizedExitId,
                                ]"
                                >{{
                                  row.authorizedExitType === 'LONG' ? 'saída longa' : 'saída curta'
                                }}<span class="sr-only"> de {{ row.residentName }}</span></a
                              >
                            }
                          </p>
                        }
                        @if (row.history.length) {
                          <details>
                            <summary>Histórico da marcação ({{ row.history.length }})</summary>
                            <ol class="local-history">
                              @for (event of row.history; track event.id) {
                                <li>
                                  <strong>{{ labels[event.mark] }}</strong> ·
                                  {{ formatTime(event.recordedAt) }}
                                  <p>
                                    {{
                                      event.actorProfile === 'sistema' ? 'Sistema' : 'Supervisor'
                                    }}
                                    @if (event.justification) {
                                      · {{ event.justification }}
                                    }
                                  </p>
                                </li>
                              }
                            </ol>
                          </details>
                        }
                      </div>
                      @if (current.status === 'ABERTA') {
                        <div
                          class="op-mark-group"
                          role="group"
                          [attr.aria-label]="'Presença de ' + row.residentName"
                        >
                          <button
                            type="button"
                            [disabled]="busy() || conflict()"
                            [class.selected]="row.mark === 'PRESENTE'"
                            [attr.aria-pressed]="row.mark === 'PRESENTE'"
                            (click)="mark(row, 'PRESENTE')"
                          >
                            Presente</button
                          ><button
                            type="button"
                            [disabled]="busy() || conflict()"
                            [class.selected]="row.mark === 'AUSENTE'"
                            [attr.aria-pressed]="row.mark === 'AUSENTE'"
                            (click)="mark(row, 'AUSENTE')"
                          >
                            Ausente
                          </button>
                          @if (row.authorizedExits.length) {
                            <button
                              type="button"
                              [disabled]="busy() || conflict()"
                              [class.selected]="row.mark === 'AUSENCIA_JUSTIFICADA'"
                              [attr.aria-pressed]="row.mark === 'AUSENCIA_JUSTIFICADA'"
                              (click)="mark(row, 'AUSENCIA_JUSTIFICADA')"
                            >
                              Ausência justificada
                            </button>
                          }
                        </div>
                      } @else {
                        <button
                          type="button"
                          class="btn op-secondary"
                          [disabled]="busy() || conflict()"
                          (click)="correct(row)"
                        >
                          Corrigir marcação<span class="sr-only"> de {{ row.residentName }}</span>
                        </button>
                      }
                    </article>
                  }
                </div>
              }
            </section>
            @if (current.status === 'ABERTA') {
              <div class="op-footer-action">
                <p aria-live="polite">
                  {{
                    current.summary.unmarked
                      ? (current.summary.unmarked === 1
                          ? 'Falta marcar 1 residente.'
                          : 'Faltam marcar ' + current.summary.unmarked + ' residentes.') +
                        ' Depois clique em Fechar chamada.'
                      : 'Todos marcados. Clique em Fechar chamada.'
                  }}
                </p>
                <button
                  type="button"
                  class="btn op-primary"
                  [disabled]="busy() || conflict() || current.summary.unmarked > 0"
                  (click)="close()"
                >
                  Fechar chamada
                </button>
              </div>
            }
          } @else {
            <section class="op-empty" role="status">
              <h2>Nenhuma chamada nesta data</h2>
              @if (date.value === ctx.referenceDate) {
                <p>
                  {{
                    ctx.eligibleResidents === 1
                      ? '1 residente'
                      : ctx.eligibleResidents + ' residentes'
                  }}
                  nesta chamada.
                </p>
                @if (ctx.missingBirthDates.length) {
                  <p class="op-warning">
                    Não é possível abrir a chamada: falta a data de nascimento no cadastro de
                    {{
                      ctx.missingBirthDates.length === 1
                        ? '1 residente'
                        : ctx.missingBirthDates.length + ' residentes'
                    }}. Corrija o cadastro e volte aqui.
                  </p>
                  <ul>
                    @for (resident of ctx.missingBirthDates; track resident.residentId) {
                      <li>
                        {{ resident.residentName }} · Matrícula {{ resident.enrollment }} · Quarto
                        {{ resident.roomNumber }}
                      </li>
                    }
                  </ul>
                } @else if (ctx.outsideWindow) {
                  <p class="op-warning">
                    Agora não é o horário da chamada. Você vai precisar escrever o motivo.
                  </p>
                }
                <button
                  type="button"
                  class="btn op-primary"
                  [disabled]="
                    busy() ||
                    conflict() ||
                    ctx.missingBirthDates.length > 0 ||
                    ctx.eligibleResidents === 0
                  "
                  (click)="open()"
                >
                  Abrir chamada
                </button>
              } @else {
                <p>
                  Só é possível abrir a chamada de hoje. Escolha a data
                  {{ formatDate(ctx.referenceDate) }}.
                </p>
              }
            </section>
          }
          @if (error()) {
            <p class="op-error" role="alert">{{ error() }}</p>
          }
          @if (success()) {
            <p class="op-success" role="status">{{ success() }}</p>
          }
          @if (conflict()) {
            <button type="button" class="btn op-secondary" (click)="load()">
              Recarregar dados
            </button>
          }
        }
      }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      details {
        margin-top: 10px;
      }
      summary {
        cursor: pointer;
        color: var(--green-800);
        min-height: 44px;
        display: flex;
        align-items: center;
        text-decoration: underline;
        text-underline-offset: 0.2em;
      }
      .local-history {
        padding-left: 20px;
      }
      .local-history li {
        margin-bottom: 12px;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class NightCallLocalComponent {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(OperationsLocalApiService);
  private readonly roomApi = inject(RoomApiService);
  private readonly dialog = inject(MatDialog);
  readonly context = signal<CallContext | null>(null);
  readonly call = signal<NightCall | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly success = signal('');
  readonly conflict = signal(false);
  readonly accommodation = new FormControl('', { nonNullable: true });
  readonly date = new FormControl('', { nonNullable: true });
  readonly search = new FormControl('', { nonNullable: true });
  readonly searchValue = signal('');
  readonly markFilter = signal('');
  readonly unit = new FormControl('', { nonNullable: true });
  readonly room = new FormControl('', { nonNullable: true });
  private readonly unitValue = signal('');
  private readonly roomValue = signal('');
  private readonly housing = signal<HousingMap>({ accommodations: [], units: [], rooms: [] });
  readonly optionsError = signal('');
  // Parte da foto da abertura: só entram quartos com residente nesta chamada.
  private readonly rosterRooms = computed(() => {
    const { rooms, units } = this.housing();
    const options = new Map<string, { id: string; unitId: string | null; label: string }>();
    for (const { roomId, roomNumber } of this.call()?.records ?? []) {
      if (options.has(roomId)) continue;
      const room = rooms.find((item) => item.id === roomId);
      options.set(roomId, {
        id: roomId,
        unitId: room?.unitId ?? null,
        label: room ? roomOptionLabel(room, units) : `Quarto ${roomNumber}`,
      });
    }
    return [...options.values()].sort((a, b) =>
      a.label.localeCompare(b.label, 'pt-BR', { numeric: true }),
    );
  });
  // Mesmo nome do filtro, para o supervisor achar o quarto de quem está na lista.
  roomOf(row: { roomId: string; roomNumber: string }): string {
    const room = this.housing().rooms.find((item) => item.id === row.roomId);
    return room
      ? `Quarto ${roomOptionLabel(room, this.housing().units)}`
      : `Quarto ${row.roomNumber}`;
  }
  readonly unitOptions = computed(() => {
    const used = new Set(this.rosterRooms().map((room) => room.unitId));
    return this.housing().units.filter((unit) => used.has(unit.id));
  });
  readonly roomOptions = computed(() =>
    this.rosterRooms().filter((room) => !this.unitValue() || room.unitId === this.unitValue()),
  );
  readonly filtered = computed(() => {
    const rooms = new Set(this.roomOptions().map((room) => room.id));
    return (this.call()?.records ?? []).filter(
      (row) =>
        normalizeSearch(`${row.residentName} ${row.enrollment}`).includes(
          normalizeSearch(this.searchValue()),
        ) &&
        (!this.markFilter() || (row.mark ?? 'PENDENTE') === this.markFilter()) &&
        rooms.has(row.roomId) &&
        (!this.roomValue() || row.roomId === this.roomValue()),
    );
  });
  readonly chips = computed<FilterChip[]>(() => {
    const mark = this.markFilter();
    const chips: [string, string, string | undefined][] = [
      ['search', 'Busca', this.searchValue().trim()],
      [
        'mark',
        'Marcação',
        mark && (mark === 'PENDENTE' ? 'Pendente' : callMarkLabels[mark as CallMark]),
      ],
      [
        'unit',
        'Casa ou bloco',
        this.unitValue() &&
          (this.unitOptions().find((u) => u.id === this.unitValue())?.name ??
            'Casa ou bloco selecionada'),
      ],
      [
        'room',
        'Quarto',
        this.roomValue() &&
          (this.rosterRooms().find((r) => r.id === this.roomValue())?.label ??
            'Quarto selecionado'),
      ],
    ];
    return chips
      .filter((chip): chip is [string, string, string] => !!chip[2])
      .map(([key, label, value]) => ({ key, label, value }));
  });
  readonly formatDate = formatCivilDate;
  readonly formatTime = formatOperationsTime;
  readonly labels = callMarkLabels;
  private sequence = 0;
  constructor() {
    rememberFilters('call-roster-search', this.search);
    this.searchValue.set(this.search.value);
    this.search.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.searchValue.set(value));
    rememberFilters('call-roster-unit', this.unit);
    rememberFilters('call-roster-room', this.room);
    this.unitValue.set(this.unit.value);
    this.roomValue.set(this.room.value);
    this.unit.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.unitValue.set(value);
      this.room.setValue('');
    });
    this.room.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.roomValue.set(value));
    if (this.session.hasRole('supervisor')) void this.load();
  }
  clearRoomFilters(): void {
    this.unit.setValue('');
    this.room.setValue('');
  }
  clearFilters(): void {
    this.search.setValue('');
    this.markFilter.set('');
    this.clearRoomFilters();
  }
  removeFilter(key: string): void {
    if (key === 'search') this.search.setValue('');
    if (key === 'mark') this.markFilter.set('');
    if (key === 'unit') this.clearRoomFilters();
    if (key === 'room') this.room.setValue('');
  }
  async load(): Promise<void> {
    if (!this.session.hasRole('supervisor') || this.busy()) return;
    const seq = ++this.sequence;
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.success.set('');
    this.conflict.set(false);
    this.call.set(null);
    try {
      let context = await this.api.callContext(this.accommodation.value || undefined);
      if (!this.accommodation.value && context.accommodations.length) {
        this.accommodation.setValue(context.accommodations[0].id);
        context = await this.api.callContext(this.accommodation.value);
      }
      if (seq !== this.sequence) return;
      this.context.set(context);
      if (!this.date.value) this.date.setValue(context.referenceDate);
      if (this.accommodation.value) {
        const [calls, housing] = await Promise.all([
          this.api.calls(this.accommodation.value, this.date.value),
          this.roomApi.map().catch(() => null),
        ]);
        if (seq === this.sequence) {
          if (housing) this.housing.set(housing);
          this.optionsError.set(
            housing ? '' : 'Não foi possível carregar casas, blocos e códigos dos quartos.',
          );
          this.call.set(calls[0] ?? null);
          if (this.unit.value && !this.unitOptions().some((unit) => unit.id === this.unit.value))
            this.unit.setValue('');
          if (this.room.value && !this.roomOptions().some((room) => room.id === this.room.value))
            this.room.setValue('');
        }
      }
    } catch (error) {
      if (seq === this.sequence) this.loadError.set(operationsError(error));
    } finally {
      if (seq === this.sequence) this.loading.set(false);
    }
  }
  async open(): Promise<void> {
    const previous = this.context();
    if (
      !previous ||
      this.date.value !== previous.referenceDate ||
      !this.accommodation.value ||
      previous.missingBirthDates.length ||
      !previous.eligibleResidents ||
      this.busy() ||
      this.conflict()
    )
      return;
    const accommodationId = this.accommodation.value;
    this.busy.set(true);
    this.error.set('');
    try {
      const context = await this.api.callContext(accommodationId);
      this.context.set(context);
      if (context.existingCallId || this.date.value !== context.referenceDate) {
        this.conflict.set(true);
        this.error.set(
          'A data mudou ou uma chamada já foi aberta. Recarregue os dados da chamada.',
        );
        return;
      }
      if (context.missingBirthDates.length || !context.eligibleResidents) {
        this.error.set('A relação de residentes mudou. Revise os impedimentos de abertura.');
        return;
      }
      this.review(
        {
          title: 'Conferir antes de abrir a chamada',
          action: 'Abrir chamada',
          lines: [
            {
              label: 'Alojamento',
              value: context.accommodations.find((a) => a.id === accommodationId)?.name ?? '',
            },
            { label: 'Data', value: formatCivilDate(context.referenceDate) },
            { label: 'Residentes', value: String(context.eligibleResidents) },
          ],
          ...this.windowReview(context),
        },
        (result) =>
          this.api.openCall({
            accommodationId,
            ...(result.confirmed
              ? { outsideWindowConfirmed: true, justification: result.reason }
              : {}),
          }),
        'Chamada aberta.',
      );
    } catch (error) {
      this.error.set(operationsError(error));
    } finally {
      this.busy.set(false);
    }
  }
  mark(row: CallResident, mark: CallMark): void {
    const call = this.call();
    if (!call || call.status !== 'ABERTA' || this.busy() || this.conflict()) return;
    if (mark === 'AUSENCIA_JUSTIFICADA' && !row.authorizedExits.length) return;
    if (mark === 'AUSENCIA_JUSTIFICADA' && row.authorizedExits.length > 1) {
      this.review(
        {
          title: 'Marcar ausência justificada',
          action: 'Registrar ausência justificada',
          lines: [{ label: 'Residente', value: row.residentName }],
          initialMark: mark,
          authorizedExits: row.authorizedExits,
        },
        (result) =>
          this.api.mark(call, row.residentId, result.mark!, undefined, result.authorizedExit),
        'Marcação registrada.',
      );
    } else
      void this.mutate(
        () =>
          this.api.mark(
            call,
            row.residentId,
            mark,
            undefined,
            mark === 'AUSENCIA_JUSTIFICADA' ? row.authorizedExits[0] : undefined,
          ),
        'Marcação registrada.',
      );
  }
  correct(row: CallResident): void {
    const call = this.call();
    if (!call || call.status !== 'FECHADA' || this.busy() || this.conflict()) return;
    this.review(
      {
        title: 'Corrigir marcação da chamada fechada',
        action: 'Salvar correção',
        lines: [
          { label: 'Residente', value: row.residentName },
          { label: 'Data da chamada', value: formatCivilDate(call.referenceDate) },
          { label: 'Marcação atual', value: row.mark ? this.labels[row.mark] : 'Sem marcação' },
        ],
        requireReason: true,
        initialMark: row.mark ?? 'PRESENTE',
        authorizedExits: row.authorizedExits,
      },
      (result) =>
        this.api.mark(call, row.residentId, result.mark!, result.reason, result.authorizedExit),
      'Correção registrada no histórico.',
    );
  }
  async close(): Promise<void> {
    const call = this.call();
    if (
      !call ||
      call.status !== 'ABERTA' ||
      call.summary.unmarked ||
      this.busy() ||
      this.conflict()
    )
      return;
    this.busy.set(true);
    try {
      const context = await this.api.callContext(call.accommodationId);
      this.context.set(context);
      this.review(
        {
          title: 'Conferir antes de fechar a chamada',
          action: 'Fechar chamada',
          lines: [
            { label: 'Data', value: formatCivilDate(call.referenceDate) },
            { label: 'Presentes', value: String(call.summary.present) },
            { label: 'Ausentes', value: String(call.summary.absent) },
            { label: 'Ausências justificadas', value: String(call.summary.justified) },
          ],
          ...this.windowReview(context),
        },
        (result) => this.api.closeCall(call, result.confirmed, result.reason),
        'Chamada fechada.',
      );
    } catch (error) {
      this.error.set(operationsError(error));
    } finally {
      this.busy.set(false);
    }
  }
  private windowReview(context: CallContext): Partial<LocalReviewData> {
    return context.outsideWindow
      ? {
          warning:
            'Agora não é o horário da chamada (22h às 23h30). Marque a confirmação e escreva o motivo.',
          requireReason: true,
          requireConfirmation: true,
        }
      : {};
  }
  private review(
    data: LocalReviewData,
    action: (result: LocalReviewResult) => Promise<NightCall>,
    message: string,
  ): void {
    this.dialog
      .open<LocalOperationsReviewDialogComponent, LocalReviewData, LocalReviewResult>(
        LocalOperationsReviewDialogComponent,
        {
          data,
          width: '620px',
          maxWidth: 'calc(100vw - 32px)',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
        },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) void this.mutate(() => action(result), message);
      });
  }
  private async mutate(action: () => Promise<NightCall>, message: string): Promise<void> {
    if (this.busy() || this.conflict()) return;
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    try {
      this.call.set(await action());
      this.success.set(message);
    } catch (error) {
      // Este conflito diz qual residente corrigir; "outra pessoa alterou" esconderia a causa.
      this.error.set(
        error instanceof OperationsApiError && error.code === 'authorized_exit_outdated'
          ? error.message
          : operationsError(error),
      );
      if (error instanceof OperationsApiError && error.status === 409) this.conflict.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
