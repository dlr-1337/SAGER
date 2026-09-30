import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
            <h2 id="local-exit-results">
              {{ longMode() ? 'Solicitações de saída longa' : 'Solicitações de saída curta' }}
            </h2>
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
        gap: 8px;
        margin: 20px 0 24px;
      }
      .exit-modalities a {
        min-height: 48px;
        min-width: 90px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--line);
        border-radius: var(--radius-control);
        padding: 8px 20px;
        color: var(--green-800);
        font-weight: 700;
        text-decoration: none;
      }
      .exit-modalities a.selected {
        background: var(--green-900);
        border-color: var(--green-900);
        color: var(--white);
      }
    `,
  ],
})
export class ExitsLocalComponent {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(OperationsLocalApiService);
  private readonly longApi = inject(LongExitApiService);
  private readonly route = inject(ActivatedRoute);
  readonly longMode = signal(false);
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
  });
  private sequence = 0;
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.longMode.set(params.get('tipo') === 'longa');
      this.filters.controls.status.setValue('');
      if (this.session.hasRole('supervisor', 'residente')) void this.load();
    });
  }
  longExit(exit: ShortExit | LongExit): LongExit | null {
    return 'signatureStatus' in exit ? exit : null;
  }
  async load(): Promise<void> {
    if (!this.session.hasRole('supervisor', 'residente')) return;
    const sequence = ++this.sequence;
    this.loading.set(true);
    this.error.set('');
    this.items.set([]);
    try {
      const value = this.filters.getRawValue();
      const items = this.longMode()
        ? await this.longApi.list(value.search.trim(), value.status)
        : await this.api.exits(value.search.trim(), value.status);
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
