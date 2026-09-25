import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';
import { ageFromBirthDate } from './management.utils';

@Component({
  selector: 'app-residents',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page">
      @if (canView()) {
        <header class="mg-heading">
          <div>
            <a class="mg-back" routerLink="/inicio"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Início</a>
            <h1>Residentes</h1>
            <p>Encontre um cadastro, confira vínculos e consulte o histórico.</p>
          </div>
          @if (canEdit()) {
            <a class="btn mg-primary" routerLink="/residentes/novo"><span class="material-symbols-rounded" aria-hidden="true">person_add</span> Cadastrar residente</a>
          }
        </header>

        <section class="panel mg-panel" aria-labelledby="resident-search-title">
          <h2 id="resident-search-title">Buscar residentes</h2>
          <form class="mg-filters" [formGroup]="filters">
            <label class="field mg-field mg-grow">Nome ou matrícula
              <input type="search" formControlName="query" placeholder="Digite o nome ou matrícula" autocomplete="off" />
            </label>
            <label class="field mg-field">Bloco
              <select formControlName="block"><option value="">Todos os blocos</option>
                @for (block of blocks(); track block) { <option [value]="block">Bloco {{ block }}</option> }
              </select>
            </label>
            <label class="field mg-field">Situação
              <select formControlName="status"><option value="">Todas</option><option value="Ativo">Ativo</option><option value="Inativo">Inativo</option></select>
            </label>
          </form>
        </section>

        <section class="mg-section" aria-labelledby="resident-results-title">
          <div class="mg-section-heading"><h2 id="resident-results-title">Cadastros</h2><p aria-live="polite">@if (scenario() === 'padrao') { {{ filtered().length }} de {{ service.residents().length }} residentes } @else { Cenário: {{ scenarioLabel() }} }</p></div>
          @if (scenario() === 'carregando') {
            <div class="mg-empty" role="status" aria-live="polite"><span class="material-symbols-rounded mg-loading-icon" aria-hidden="true">progress_activity</span><h3>Carregando residentes</h3><p>Este é um estado simulado para revisão da interface.</p><button type="button" class="btn mg-secondary" (click)="restoreScenario()">Voltar ao cenário padrão</button></div>
          } @else if (scenario() === 'erro') {
            <div class="mg-empty" role="alert"><span class="material-symbols-rounded" aria-hidden="true">error</span><h3>Não foi possível carregar residentes</h3><p>Falha simulada. Tente novamente para voltar aos dados de demonstração.</p><button type="button" class="btn mg-primary" (click)="restoreScenario()">Tentar novamente</button></div>
          } @else if (scenario() === 'vazio') {
            <div class="mg-empty" role="status"><span class="material-symbols-rounded" aria-hidden="true">person_off</span><h3>Nenhum residente cadastrado</h3><p>Este é o estado vazio da demonstração.</p><button type="button" class="btn mg-secondary" (click)="restoreScenario()">Voltar ao cenário padrão</button></div>
          } @else if (filtered().length) {
            <div class="mg-list">
              @for (resident of filtered(); track resident.id) {
                <article class="mg-row">
                  <div class="mg-avatar" aria-hidden="true">{{ resident.name.slice(0, 1) }}</div>
                  <div class="mg-row-main"><h3>{{ resident.name }}</h3><p>Matrícula {{ resident.enrollment }} · {{ resident.course }}</p></div>
                  <div class="mg-row-detail"><strong>{{ service.roomLabel(resident.roomId) }}</strong><span>{{ age(resident.birthDate) }} anos · {{ resident.status }}</span></div>
                  <a class="mg-row-link" [routerLink]="['/residentes', resident.id]">Ver cadastro <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></a>
                </article>
              }
            </div>
          } @else {
            <div class="mg-empty" role="status"><span class="material-symbols-rounded" aria-hidden="true">search_off</span><h3>Nenhum residente encontrado</h3><p>Altere os filtros ou confira a matrícula digitada.</p><button type="button" class="btn mg-secondary" (click)="clearFilters()">Limpar filtros</button></div>
          }
        </section>
      } @else {
        <section class="mg-empty" role="alert"><span class="material-symbols-rounded" aria-hidden="true">lock</span><h1>Acesso restrito</h1><p>Esta área está disponível para gestor e supervisor.</p><a class="btn mg-primary" routerLink="/inicio">Voltar ao início</a></section>
      }
    </main>
  `,
})
export class ResidentsComponent {
  readonly service = inject(ManagementDemoService);
  private readonly session = inject(DemoSessionService);
  readonly canView = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly canEdit = computed(() => this.session.hasRole('gestor'));
  readonly scenario = this.session.scenario;
  readonly filters = new FormGroup({
    query: new FormControl('', { nonNullable: true }),
    block: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
  });
  private readonly criteria = toSignal(this.filters.valueChanges, { initialValue: this.filters.getRawValue() });
  readonly blocks = computed(() => [...new Set(this.service.rooms().map((room) => room.block))].sort());
  readonly filtered = computed(() => {
    const { query, block, status } = this.criteria();
    const text = (query ?? '').trim().toLocaleLowerCase('pt-BR');
    return this.service.residents().filter((resident) => {
      const room = resident.roomId ? this.service.room(resident.roomId) : undefined;
      return (!text || `${resident.name} ${resident.enrollment}`.toLocaleLowerCase('pt-BR').includes(text))
        && (!block || room?.block === block)
        && (!status || resident.status === status);
    });
  });
  readonly age = ageFromBirthDate;

  clearFilters(): void {
    this.filters.reset({ query: '', block: '', status: '' });
  }

  scenarioLabel(): string {
    return { vazio: 'sem dados', erro: 'erro', carregando: 'carregando', padrao: 'padrão' }[this.scenario()];
  }

  restoreScenario(): void {
    this.session.setScenario('padrao');
  }
}
