import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { OperationsDemoService } from './operations-demo.service';

@Component({
  standalone: true,
  selector: 'app-exits',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page">
      <header class="op-heading">
        <div><a routerLink="/inicio" class="op-back">← Início</a><h1>Saídas</h1><p>{{ session.hasRole('residente') ? 'Acompanhe suas solicitações e veja o que falta em cada etapa.' : 'Analise solicitações, assinaturas e retornos em um só lugar.' }}</p></div>
        @if (session.hasRole('residente')) { <a class="btn op-primary" routerLink="/saidas/nova"><span class="material-symbols-outlined" aria-hidden="true">add</span> Solicitar saída</a> }
      </header>
      <p class="op-demo-label">Registros sintéticos para demonstração</p>
      @if (session.hasRole('residente')) { <p class="op-help">Solicitações formais de saída são destinadas aos residentes menores de idade. Apenas um supervisor confirma o retorno curto presencialmente.</p> }
      @else { <p class="op-help">Saídas longas aguardam documento assinado antes da aprovação. Mensagem enviada ou lida ainda não é assinatura.</p> }
      <section class="panel op-panel" aria-labelledby="exit-filter-title"><h2 id="exit-filter-title">Buscar solicitações</h2>
        <form class="op-filters" [formGroup]="filters">
          <label class="field">Nome, matrícula ou quarto<input formControlName="query" type="search" placeholder="Digite para buscar" /></label>
          <label class="field">Tipo<select formControlName="kind"><option value="">Todas</option><option value="Curta">Curta</option><option value="Longa">Longa</option></select></label>
          <label class="field">Situação<select formControlName="status"><option value="">Todas</option><option value="pendente">Pendentes</option><option value="concluida">Concluídas</option></select></label>
        </form>
      </section>
      <section class="op-section" aria-labelledby="exit-results-title">
        <div class="op-section-heading"><h2 id="exit-results-title">Solicitações</h2><p aria-live="polite">{{ filtered().length }} registro(s)</p></div>
        @if (session.scenario()==='carregando') { <div class="op-state" role="status" aria-live="polite"><span class="material-symbols-outlined" aria-hidden="true">progress_activity</span><h3>Carregando solicitações</h3><p>Aguarde enquanto a lista de demonstração é preparada.</p></div> }
        @else if (session.scenario()==='erro') { <div class="op-state" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span><h3>Não foi possível carregar as saídas</h3><p>Este é um cenário de erro demonstrativo. Tente carregar novamente.</p><button type="button" class="btn op-secondary" (click)="session.setScenario('padrao')">Tentar novamente</button></div> }
        @else if (session.scenario()==='vazio') { <div class="op-empty" role="status"><h3>Nenhuma solicitação neste cenário</h3><p>Selecione o cenário padrão no topo para ver os registros sintéticos.</p></div> }
        @else if (filtered().length) {
          <div class="op-list">
            @for (item of filtered(); track item.id) {
              <article class="op-row">
                <div class="op-row-main"><h3>{{ item.resident }}</h3><p>{{ item.id }} · {{ item.kind }} · {{ item.room }}</p><p>Saída {{ item.departure | date:'dd/MM/yyyy, HH:mm' }}</p></div>
                <div class="op-row-side"><span class="op-status" [class.op-status-warn]="item.status==='Falha no envio' || item.status==='Aguardando assinatura'">{{ item.status }}</span>
                  @if (item.kind === 'Longa' && !item.signed) { <small>Assinatura pendente</small> }
                </div>
                <a class="op-row-link" [routerLink]="['/saidas', item.id]">Ver solicitação <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></a>
              </article>
            }
          </div>
        } @else { <div class="op-empty" role="status"><span class="material-symbols-outlined" aria-hidden="true">search_off</span><h3>Nenhuma saída encontrada</h3><p>Altere os filtros para consultar outros registros de demonstração.</p><button type="button" class="btn op-secondary" (click)="clear()">Limpar filtros</button></div> }
      </section>
    </main>
  `,
})
export class ExitsComponent {
  readonly session = inject(DemoSessionService);
  readonly service = inject(OperationsDemoService);
  readonly filters = new FormGroup({
    query: new FormControl('', { nonNullable: true }),
    kind: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
  });
  private readonly criteria = toSignal(this.filters.valueChanges, { initialValue: this.filters.getRawValue() });
  readonly filtered = computed(() => {
    const { query, kind, status } = this.criteria();
    const text = (query ?? '').trim().toLocaleLowerCase('pt-BR');
    return this.service.exits().filter((item) => {
      if (this.session.hasRole('residente') && item.residentId !== this.service.residentId) return false;
      if (text && !`${item.resident} ${item.registration} ${item.room} ${item.id}`.toLocaleLowerCase('pt-BR').includes(text)) return false;
      if (kind && item.kind !== kind) return false;
      if (status === 'pendente' && !['Aguardando análise', 'Aguardando assinatura', 'Falha no envio', 'Em andamento'].includes(item.status)) return false;
      if (status === 'concluida' && ['Aguardando análise', 'Aguardando assinatura', 'Falha no envio', 'Em andamento'].includes(item.status)) return false;
      return true;
    });
  });
  clear(): void { this.filters.reset({ query: '', kind: '', status: '' }); }
}
