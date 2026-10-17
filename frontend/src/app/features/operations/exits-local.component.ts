import { PaginationComponent } from '../../shared/pagination.component';
import { debounceTime } from 'rxjs';
import { AccommodationApiService } from '../management/accommodation-api.service';
import { Accommodation } from '../management/housing.models';
import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { FilterState, rememberFilters } from '../../core/filter-state';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
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
                ? 'Acompanhe suas solicitações e autorizações de saída.'
                : 'Analise os pedidos e registre a partida e o retorno presenciais.'
            }}
          </p>
        </div>
        @if (session.hasRole('residente')) {
          <a
            class="btn op-primary"
            [routerLink]="longMode() ? '/saidas/longas/nova' : '/saidas/nova'"
            >{{ longMode() ? 'Solicitar saída longa' : 'Solicitar saída curta' }}</a
          >
        }
      </header>
      <p class="op-help">
        {{
          longMode()
            ? 'Saídas longas: mais de 3 horas, com assinatura de um responsável elegível antes da aprovação.'
            : 'Saídas curtas: até 3 horas.'
        }}
        Os horários são apresentados no horário de Brasília.
      </p>
      <nav class="exit-modalities" aria-label="Modalidade da saída">
        <a
          routerLink="/saidas"
          [class.selected]="!longMode()"
          [attr.aria-current]="!longMode() ? 'page' : null"
          >Curtas</a
        ><a
          routerLink="/saidas"
          [queryParams]="{ tipo: 'longa' }"
          [class.selected]="longMode()"
          [attr.aria-current]="longMode() ? 'page' : null"
          >Longas</a
        >
      </nav>
      @if (!session.hasRole('supervisor', 'residente')) {
        <section class="op-empty" role="alert">
          <h2>Acesso restrito</h2>
          <p>A consulta de saídas está disponível ao supervisor e ao residente vinculado.</p>
        </section>
      } @else {
        <section class="panel op-panel" aria-labelledby="local-exit-filters">
          <h2 id="local-exit-filters">Buscar solicitações</h2>
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
            @if (session.hasRole('supervisor')) {
              <label class="field"
                >Alojamento<select sagerSearchable formControlName="accommodationId">
                  <option value="">Todos</option>
                  @for (a of accommodations(); track a.id) {
                    <option [value]="a.id">{{ a.name }}</option>
                  }
                </select></label
              >
            }
            <button type="button" class="btn op-secondary" (click)="clear()">Limpar filtros</button>
            <button type="submit" class="btn op-secondary" [disabled]="loading()">Buscar</button>
          </form>
        </section>
        @if (optionsError()) {
          <p class="op-help">{{ optionsError() }}</p>
        }
        <section class="op-section" aria-labelledby="local-exit-results">
          <div class="op-section-heading">
            <h2 id="local-exit-results">
              {{ longMode() ? 'Solicitações de saída longa' : 'Solicitações de saída curta' }}
            </h2>
            @if (!loading() && !error()) {
              <p aria-live="polite">{{ total() }} registro(s)</p>
            }
          </div>
          @if (loading()) {
            <div class="op-state" role="status">
              <h3>Carregando solicitações</h3>
              <p>Aguarde a consulta dos registros.</p>
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
              <h3>Nenhuma saída encontrada</h3>
              <p>Nenhuma solicitação corresponde aos filtros atuais.</p>
              <button type="button" class="btn op-secondary" (click)="clear()">
                Limpar filtros
              </button>
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
                      Saída solicitada {{ formatTime(exit.requestedDepartureAt) }} · Retorno
                      previsto {{ formatTime(exit.expectedReturnAt) }}
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
                    >Ver solicitação<span class="material-symbols-outlined" aria-hidden="true"
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
        display: flex;
        flex-wrap: wrap;
        width: fit-content;
        max-width: 100%;
        margin: 20px 0 24px;
        border: 1px solid var(--line);
        border-radius: 12px;
        overflow: hidden;
        background: #fff;
      }
      .exit-modalities a {
        min-height: 48px;
        min-width: 90px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 20px;
        border-right: 1px solid var(--line);
        color: var(--ink);
        font-weight: 600;
        text-decoration: none;
      }
      .exit-modalities a:last-child {
        border-right: 0;
      }
      .exit-modalities a.selected {
        background: var(--green-900);
        color: #fff;
        font-weight: 700;
      }
    `,
  ],
})
export class ExitsLocalComponent {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(OperationsLocalApiService);
  private readonly longApi = inject(LongExitApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly filterState = inject(FilterState);
  private readonly destroy = inject(DestroyRef);
  private readonly accommodationApi = inject(AccommodationApiService);
  readonly accommodations = signal<Accommodation[]>([]);
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
  });
  private sequence = 0;
  constructor() {
    rememberFilters('exits-local.component', this.filters);
    this.filters.valueChanges.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => {
      this.page.set(0);
      void this.load();
    });
    if (this.session.hasRole('supervisor'))
      void this.accommodationApi
        .list()
        .then((items) => {
          if (!this.destroy.destroyed) this.accommodations.set(items);
        })
        .catch(() => {
          if (!this.destroy.destroyed)
            this.optionsError.set(
              'Não foi possível carregar os alojamentos. Recarregue a página para tentar novamente.',
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
        throw new Error('A data inicial deve ser anterior ou igual à final.');
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
    this.filters.reset({ search: '', status: '', from: '', to: '', accommodationId: '' });
    this.page.set(0);
    void this.load();
  }
}
