import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { OperationsDemoService } from './operations-demo.service';
import { NotificationsLocalPage } from '../communications/notifications-local.pages';

@Component({
  standalone: true,
  selector: 'app-notifications',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, NotificationsLocalPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!session.active()) {
      <sager-notifications-local />
    } @else {
      <main class="page op-page">
        @if (session.hasRole('supervisor', 'gestor')) {
          <header class="op-heading">
            <div>
              <a routerLink="/inicio" class="op-back">← Início</a>
              <h1>Notificações internas</h1>
              <p>Ocorrências aguardam análise humana antes de qualquer decisão.</p>
            </div>
            <span class="op-demo-label">Dados de demonstração</span>
          </header>
          <p class="op-help">
            Uma notificação interna não é uma advertência. O residente não vê estes itens enquanto
            estão em análise.
          </p>
          <section class="panel op-panel" aria-labelledby="notification-filter-title">
            <h2 id="notification-filter-title">Filtrar notificações</h2>
            <form class="op-filters" [formGroup]="filters">
              <label class="field"
                >Buscar residente ou origem<input
                  type="search"
                  formControlName="query"
                  placeholder="Digite nome ou origem"
              /></label>
              <label class="field"
                >Situação<select formControlName="status">
                  <option value="">Todas</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Visualizada">Visualizada</option>
                  <option value="Em análise">Em análise</option>
                  <option value="Arquivada">Arquivada</option>
                  <option value="Convertida em advertência">Convertida em advertência</option>
                </select></label
              >
            </form>
          </section>
          <section class="op-section" aria-labelledby="notification-results-title">
            <div class="op-section-heading">
              <h2 id="notification-results-title">Itens para revisão</h2>
              <p aria-live="polite">{{ filtered().length }} registro(s)</p>
            </div>
            @if (session.scenario() === 'carregando') {
              <div class="op-state" role="status" aria-live="polite">
                <span class="material-symbols-outlined" aria-hidden="true">progress_activity</span>
                <h3>Carregando notificações</h3>
                <p>Aguarde enquanto os itens de demonstração são preparados.</p>
              </div>
            } @else if (session.scenario() === 'erro') {
              <div class="op-state" role="alert">
                <span class="material-symbols-outlined" aria-hidden="true">error</span>
                <h3>Não foi possível carregar as notificações</h3>
                <p>Este é um cenário de erro demonstrativo.</p>
                <button
                  type="button"
                  class="btn op-secondary"
                  (click)="session.setScenario('padrao')"
                >
                  Tentar novamente
                </button>
              </div>
            } @else if (session.scenario() === 'vazio') {
              <div class="op-empty" role="status">
                <h3>Nenhuma notificação neste cenário</h3>
                <p>Selecione o cenário padrão no topo para ver os itens sintéticos.</p>
              </div>
            } @else if (filtered().length) {
              <div class="op-list">
                @for (item of filtered(); track item.id) {
                  <article class="op-row">
                    <div class="op-row-main">
                      <h3>{{ item.resident }}</h3>
                      <p>{{ item.id }} · {{ item.source }}</p>
                      <p>{{ item.reason }}</p>
                    </div>
                    <div class="op-row-side">
                      <span class="op-status">{{ item.status }}</span
                      ><small>{{ item.at | date: 'dd/MM/yyyy, HH:mm' }}</small>
                    </div>
                    <a class="op-row-link" [routerLink]="['/notificacoes', item.id]"
                      >Abrir análise
                      <span class="material-symbols-outlined" aria-hidden="true"
                        >arrow_forward</span
                      ></a
                    >
                  </article>
                }
              </div>
            } @else {
              <div class="op-empty" role="status">
                <h3>Nenhuma notificação encontrada</h3>
                <p>Altere os filtros para consultar outros itens.</p>
                <button type="button" class="btn op-secondary" (click)="clear()">
                  Limpar filtros
                </button>
              </div>
            }
          </section>
          <p class="op-help">
            Critérios de geração, gravidade e evidências mínimas ainda dependem de definição da AE.
            Estes registros foram criados apenas para demonstração.
          </p>
        } @else {
          <section class="op-empty" role="alert">
            <h1>Acesso restrito</h1>
            <p>Notificações internas não são exibidas para residentes.</p>
            <a class="btn op-primary" routerLink="/inicio">Voltar ao início</a>
          </section>
        }
      </main>
    }
  `,
})
export class NotificationsComponent {
  readonly session = inject(DemoSessionService);
  readonly service = inject(OperationsDemoService);
  readonly filters = new FormGroup({
    query: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
  });
  private readonly criteria = toSignal(this.filters.valueChanges, {
    initialValue: this.filters.getRawValue(),
  });
  readonly filtered = computed(() => {
    if (!this.session.active()) return [];
    const { query, status } = this.criteria();
    const text = (query ?? '').trim().toLocaleLowerCase('pt-BR');
    return this.service
      .notifications()
      .filter(
        (item) =>
          (!text ||
            `${item.resident} ${item.source} ${item.reason}`
              .toLocaleLowerCase('pt-BR')
              .includes(text)) &&
          (!status || item.status === status),
      );
  });
  clear(): void {
    this.filters.reset({ query: '', status: '' });
  }
}
