import { PaginationComponent } from '../../shared/pagination.component';
import { debounceTime } from 'rxjs';
import { RoomApiService } from '../management/room-api.service';
import {
  AccommodationUnit,
  HousingMap,
  RoomRecord,
  cascadeLocation,
  clearMissingLocation,
  roomOptionLabel,
  roomsIn,
  unitOptionLabel,
  unitsIn,
} from '../management/housing.models';
import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { FilterState, rememberFilters } from '../../core/filter-state';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { OperationsLocalApiService, operationsError } from './operations-local-api.service';
import { ShortExit } from './operations-local.models';
import { exitStatusLabels, formatOperationsTime } from './operations-local.utils';
import { LongExitApiService } from './long-exit-api.service';
import { LongExit } from './long-exit.models';
import { messageStatusLabels, signatureStatusLabels } from './long-exit.utils';

@Component({
  standalone: true,
  selector: 'app-exits-local',
  imports: [PaginationComponent, SearchableSelectDirective, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page">
      <header class="op-heading">
        <div>
          <a routerLink="/inicio" class="op-back">← Início</a>
          <h1>Saídas e retornos</h1>
          <p>
            {{
              session.hasRole('residente')
                ? 'Veja seus pedidos de saída.'
                : 'Veja os pedidos e registre a saída e a volta de cada residente.'
            }}
          </p>
        </div>
        @if (session.hasRole('residente')) {
          <div class="exit-requests">
            <a class="btn op-primary" routerLink="/saidas/nova">Pedir saída curta (até 3 horas)</a>
            <a class="btn op-primary" routerLink="/saidas/longas/nova"
              >Pedir saída longa (mais de 3 horas)</a
            >
          </div>
        }
      </header>
      <p class="op-help">
        {{
          longMode()
            ? 'Saídas longas: mais de 3 horas. Precisam da autorização do responsável, conferida por um servidor, antes da aprovação.'
            : 'Saídas curtas: até 3 horas.'
        }}
        Horário de Brasília.
      </p>
      <nav class="exit-modalities segmented" aria-label="Tipo de saída">
        <a
          routerLink="/saidas"
          [class.selected]="!longMode()"
          [attr.aria-current]="!longMode() ? 'page' : null"
          >Saídas curtas</a
        ><a
          routerLink="/saidas"
          [queryParams]="{ tipo: 'longa' }"
          [class.selected]="longMode()"
          [attr.aria-current]="longMode() ? 'page' : null"
          >Saídas longas</a
        >
      </nav>
      @if (!session.hasRole('supervisor', 'residente')) {
        <section class="op-empty" role="alert">
          <h2>Acesso restrito</h2>
          <p>Só o supervisor e o próprio residente podem ver as saídas.</p>
        </section>
      } @else {
        @if (session.hasRole('supervisor')) {
          <section class="panel op-panel" aria-labelledby="local-exit-filters">
            <h2 id="local-exit-filters">Buscar pedidos</h2>
            <form class="op-filters" [formGroup]="filters" (ngSubmit)="load()">
              <label class="field"
                >Nome ou matrícula<input type="search" formControlName="search" /></label
              ><label class="field"
                >Situação<select sagerSearchable formControlName="status">
                  <option value="">Todas</option>
                  @for (status of statuses; track status) {
                    <option [value]="status">{{ labels[status] }}</option>
                  }
                </select></label
              >
              <label class="field"
                >Saída a partir de<input type="date" formControlName="from" /></label
              ><label class="field">Saída até<input type="date" formControlName="to" /></label>
              <label class="field"
                >Alojamento<select sagerSearchable formControlName="accommodationId">
                  <option value="">Todos</option>
                  @for (a of housing().accommodations; track a.id) {
                    <option [value]="a.id">{{ a.name }}</option>
                  }
                </select></label
              ><label class="field"
                >Casa ou bloco<select sagerSearchable formControlName="unitId">
                  <option value="">Todos</option>
                  @for (unit of visibleUnits(); track unit.id) {
                    <option [value]="unit.id">{{ unitLabel(unit) }}</option>
                  }
                </select></label
              ><label class="field"
                >Quarto<select sagerSearchable formControlName="roomId">
                  <option value="">Todos os quartos</option>
                  @for (room of visibleRooms(); track room.id) {
                    <option [value]="room.id">{{ roomLabel(room) }}</option>
                  }
                </select></label
              >
              <button type="button" class="btn op-secondary" (click)="clear()">
                Limpar filtros
              </button>
              <button type="submit" class="btn op-secondary" [disabled]="loading()">Buscar</button>
            </form>
          </section>
        }
        @if (optionsError()) {
          <p class="op-help">{{ optionsError() }}</p>
        }
        <section class="op-section mg-tab-panel" aria-labelledby="local-exit-results">
          <div class="op-section-heading">
            <h2 id="local-exit-results">
              {{ longMode() ? 'Pedidos de saída longa' : 'Pedidos de saída curta' }}
            </h2>
            @if (!loading() && !error() && total()) {
              <p aria-live="polite">{{ total() === 1 ? '1 pedido' : total() + ' pedidos' }}</p>
            }
          </div>
          @if (loading()) {
            <div class="op-state" role="status">
              <h3>Carregando pedidos</h3>
              <p>Aguarde um momento.</p>
            </div>
          } @else if (error()) {
            <div class="op-state" role="alert">
              <h3>Não foi possível carregar as saídas</h3>
              <p>{{ error() }}</p>
              <button class="btn op-secondary" type="button" (click)="load()">
                Tentar novamente
              </button>
            </div>
          } @else if (!items().length) {
            <div class="op-empty" role="status">
              @if (session.hasRole('residente')) {
                <h3>Nenhum pedido ainda.</h3>
              } @else {
                <h3>Nenhuma saída encontrada</h3>
                <p>Nenhum pedido combina com os filtros.</p>
                <button type="button" class="btn op-secondary" (click)="clear()">
                  Limpar filtros
                </button>
              }
            </div>
          } @else {
            <div class="op-list">
              @for (exit of items(); track exit.id) {
                <article class="op-row">
                  <div class="op-row-main">
                    <h3>{{ exit.residentName }}</h3>
                    <p>
                      Matrícula {{ exit.enrollment }} ·
                      {{ longMode() ? 'Saída longa' : 'Saída curta' }}
                    </p>
                    <p>
                      Saída: {{ formatTime(exit.requestedDepartureAt) }} · Volta:
                      {{ formatTime(exit.expectedReturnAt) }}
                    </p>
                  </div>
                  <div class="op-row-side">
                    <span class="op-status">{{ labels[exit.status] }}</span>
                    @if (longExit(exit); as long) {
                      <small>{{ signatures[long.signatureStatus] }}</small
                      ><small>{{ messages[long.messageStatus] }}</small>
                    }
                  </div>
                  <a
                    class="op-row-link"
                    [routerLink]="longMode() ? ['/saidas/longas', exit.id] : ['/saidas', exit.id]"
                    >Ver pedido<span class="material-symbols-outlined" aria-hidden="true"
                      >arrow_forward</span
                    ></a
                  >
                </article>
              }
            </div>
          }
          <sager-pagination
            [page]="page()"
            [total]="total()"
            [busy]="loading()"
            (pageChange)="changePage($event)"
          />
        </section>
      }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .exit-modalities {
        margin: 20px 0 24px;
      }
      .exit-modalities a {
        min-width: 90px;
      }
    `,
  ],
})
export class ExitsLocalComponent {
  readonly session = inject(SessionService);
  private readonly api = inject(OperationsLocalApiService);
  private readonly longApi = inject(LongExitApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly filterState = inject(FilterState);
  private readonly destroy = inject(DestroyRef);
  private readonly roomApi = inject(RoomApiService);
  readonly housing = signal<HousingMap>({ accommodations: [], units: [], rooms: [] });
  readonly optionsError = signal('');
  readonly total = signal(0);
  readonly page = signal(0);
  private request?: AbortController;
  changePage(page: number): void {
    this.page.set(page);
    void this.load();
  }
  readonly longMode = signal(this.route.snapshot.queryParamMap.get('tipo') === 'longa');
  readonly items = signal<(ShortExit | LongExit)[]>([]);
  readonly signatures = signatureStatusLabels;
  readonly messages = messageStatusLabels;
  readonly loading = signal(false);
  readonly error = signal('');
  readonly labels = exitStatusLabels;
  readonly statuses = Object.keys(exitStatusLabels) as (keyof typeof exitStatusLabels)[];
  readonly formatTime = formatOperationsTime;
  readonly filters = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    accommodationId: new FormControl('', { nonNullable: true }),
    unitId: new FormControl('', { nonNullable: true }),
    roomId: new FormControl('', { nonNullable: true }),
  });
  private readonly location = toSignal(this.filters.valueChanges, {
    initialValue: this.filters.getRawValue(),
  });
  readonly visibleUnits = computed(() => unitsIn(this.housing(), this.location().accommodationId));
  readonly visibleRooms = computed(() =>
    roomsIn(this.housing(), this.location().accommodationId, this.location().unitId),
  );
  private sequence = 0;
  constructor() {
    rememberFilters('exits-local.component', this.filters);
    cascadeLocation(this.filters.controls);
    // A página volta ao início na hora: esperar a pausa desfazia um clique em "Próxima".
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.page.set(0));
    this.filters.valueChanges.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => {
      void this.load();
    });
    if (this.session.hasRole('supervisor'))
      void this.roomApi
        .map()
        .then((housing) => {
          if (this.destroy.destroyed) return;
          this.housing.set(housing);
          clearMissingLocation(housing, this.filters.controls);
        })
        .catch(() => {
          if (!this.destroy.destroyed)
            this.optionsError.set(
              'Não foi possível carregar os alojamentos e quartos. Recarregue a página para tentar novamente.',
            );
        });
    this.destroy.onDestroy(() => {
      this.sequence++;
      this.request?.abort();
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const longMode = params.get('tipo') === 'longa';
      if (longMode !== this.longMode()) {
        this.filters.controls.status.setValue('', { emitEvent: false });
        this.filterState.values.set('exits-local.component', this.filters.getRawValue());
      }
      this.longMode.set(longMode);
      this.page.set(0);
      if (this.session.hasRole('supervisor', 'residente')) void this.load();
    });
  }
  roomLabel(room: RoomRecord): string {
    return roomOptionLabel(room, this.housing().units);
  }
  unitLabel(unit: AccommodationUnit): string {
    return unitOptionLabel(unit, this.housing(), this.location().accommodationId);
  }
  longExit(exit: ShortExit | LongExit): LongExit | null {
    return 'signatureStatus' in exit ? exit : null;
  }
  async load(): Promise<void> {
    if (!this.session.hasRole('supervisor', 'residente')) return;
    const sequence = ++this.sequence;
    this.request?.abort();
    const request = (this.request = new AbortController());
    this.loading.set(true);
    this.error.set('');
    this.items.set([]);
    try {
      const value = this.filters.getRawValue();
      if (value.from && value.to && value.from > value.to)
        throw new Error('A data inicial precisa vir antes da final. Corrija as datas.');
      const params = {
        ...Object.fromEntries(Object.entries(value).filter(([, value]) => !!value)),
        limit: '25',
        offset: String(this.page() * 25),
      };
      const result = this.longMode()
        ? await this.longApi.page(params, request.signal)
        : await this.api.exitsPage(params, request.signal);
      if (sequence === this.sequence) {
        this.items.set(result.items);
        this.total.set(result.total);
        if (this.page() && this.page() * 25 >= result.total) {
          this.changePage(Math.max(0, Math.ceil(result.total / 25) - 1));
        }
      }
    } catch (error) {
      if (sequence === this.sequence) this.error.set(operationsError(error));
    } finally {
      if (sequence === this.sequence) this.loading.set(false);
    }
  }
  clear(): void {
    this.filters.reset({
      search: '',
      status: '',
      from: '',
      to: '',
      accommodationId: '',
      unitId: '',
      roomId: '',
    });
    this.page.set(0);
    void this.load();
  }
}
