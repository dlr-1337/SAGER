import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { OperationsLocalApiService, operationsError } from './operations-local-api.service';
import { ShortExit } from './operations-local.models';
import { exitStatusLabels, formatOperationsTime } from './operations-local.utils';

@Component({
  standalone: true,
  selector: 'app-exits-local',
  imports: [ReactiveFormsModule, RouterLink],
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
                ? 'Acompanhe suas solicitações de saída curta.'
                : 'Analise os pedidos e registre a partida e o retorno presenciais.'
            }}
          </p>
        </div>
        @if (session.hasRole('residente')) {
          <a class="btn op-primary" routerLink="/saidas/nova">Solicitar saída curta</a>
        }
      </header>
      <p class="op-help">
        Saídas curtas: até 3 horas. Os horários são apresentados no horário de Brasília. Saídas
        longas ainda estão indisponíveis no ambiente local.
      </p>
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
              >Situação<select formControlName="status">
                <option value="">Todas</option>
                @for (status of statuses; track status) {
                  <option [value]="status">{{ labels[status] }}</option>
                }
              </select></label
            ><button type="submit" class="btn op-secondary" [disabled]="loading()">Buscar</button>
          </form>
        </section>
        <section class="op-section" aria-labelledby="local-exit-results">
          <div class="op-section-heading">
            <h2 id="local-exit-results">Solicitações de saída curta</h2>
            @if (!loading() && !error()) {
              <p aria-live="polite">{{ items().length }} registro(s)</p>
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
                    <p>Matrícula {{ exit.enrollment }} · Saída curta</p>
                    <p>
                      Saída solicitada {{ formatTime(exit.requestedDepartureAt) }} · Retorno
                      previsto {{ formatTime(exit.expectedReturnAt) }}
                    </p>
                  </div>
                  <div class="op-row-side">
                    <span class="op-status">{{ labels[exit.status] }}</span>
                  </div>
                  <a class="op-row-link" [routerLink]="['/saidas', exit.id]"
                    >Ver solicitação<span class="material-symbols-outlined" aria-hidden="true"
                      >arrow_forward</span
                    ></a
                  >
                </article>
              }
            </div>
          }
        </section>
      }
    </main>
  `,
})
export class ExitsLocalComponent {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(OperationsLocalApiService);
  readonly items = signal<ShortExit[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly labels = exitStatusLabels;
  readonly statuses = Object.keys(exitStatusLabels) as (keyof typeof exitStatusLabels)[];
  readonly formatTime = formatOperationsTime;
  readonly filters = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
  });
  private sequence = 0;
  constructor() {
    if (this.session.hasRole('supervisor', 'residente')) void this.load();
  }
  async load(): Promise<void> {
    if (!this.session.hasRole('supervisor', 'residente')) return;
    const sequence = ++this.sequence;
    this.loading.set(true);
    this.error.set('');
    this.items.set([]);
    try {
      const value = this.filters.getRawValue();
      const items = await this.api.exits(value.search.trim(), value.status);
      if (sequence === this.sequence) this.items.set(items);
    } catch (error) {
      if (sequence === this.sequence) this.error.set(operationsError(error));
    } finally {
      if (sequence === this.sequence) this.loading.set(false);
    }
  }
  clear(): void {
    this.filters.reset({ search: '', status: '' });
    void this.load();
  }
}
