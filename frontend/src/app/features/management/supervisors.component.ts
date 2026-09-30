import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';
import { Supervisor } from './management.models';
import { SupervisorApiError, SupervisorApiService } from './supervisor-api.service';

@Component({
  selector: 'app-supervisors',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page">
      @if (canEdit()) {
        <header class="mg-heading">
          <div>
            <a class="mg-back" routerLink="/inicio"
              ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Início</a
            >
            <h1>Supervisores</h1>
            <p>Gerencie os registros funcionais da equipe de residência.</p>
          </div>
          <a class="btn mg-primary" routerLink="/supervisores/novo"
            ><span class="material-symbols-rounded" aria-hidden="true">person_add</span> Cadastrar
            supervisor</a
          >
        </header>
        <section class="panel mg-panel" aria-labelledby="supervisor-search-title">
          <h2 id="supervisor-search-title">Buscar supervisores</h2>
          <label class="field mg-field"
            >Nome ou identificação institucional<input
              type="search"
              [formControl]="search"
              placeholder="Digite um nome ou identificação"
              autocomplete="off"
          /></label>
        </section>
        <section class="mg-section" aria-labelledby="supervisor-results-title">
          <div class="mg-section-heading">
            <h2 id="supervisor-results-title">Equipe cadastrada</h2>
            <p aria-live="polite">
              @if (isDemo() && scenario() !== 'padrao') {
                Cenário demonstrativo
              } @else if (!loading() && !loadError()) {
                {{ filtered().length }} de {{ supervisors().length }} supervisores
              }
            </p>
          </div>
          @if (isDemo() && scenario() === 'carregando') {
            <div class="mg-empty" role="status" aria-live="polite">
              <span class="material-symbols-rounded mg-loading-icon" aria-hidden="true"
                >progress_activity</span
              >
              <h3>Carregando supervisores</h3>
              <p>Este é um estado simulado para revisão da interface.</p>
              <button type="button" class="btn mg-secondary" (click)="restoreScenario()">
                Voltar ao cenário padrão
              </button>
            </div>
          } @else if (isDemo() && scenario() === 'erro') {
            <div class="mg-empty" role="alert">
              <span class="material-symbols-rounded" aria-hidden="true">error</span>
              <h3>Não foi possível carregar supervisores</h3>
              <p>Falha simulada. Tente novamente para voltar aos dados de demonstração.</p>
              <button type="button" class="btn mg-primary" (click)="restoreScenario()">
                Tentar novamente
              </button>
            </div>
          } @else if (isDemo() && scenario() === 'vazio') {
            <div class="mg-empty" role="status">
              <span class="material-symbols-rounded" aria-hidden="true">group_off</span>
              <h3>Nenhum supervisor cadastrado</h3>
              <p>Este é o estado vazio da demonstração.</p>
              <button type="button" class="btn mg-secondary" (click)="restoreScenario()">
                Voltar ao cenário padrão
              </button>
            </div>
          } @else if (loading()) {
            <div class="mg-empty" role="status" aria-live="polite">
              <span class="material-symbols-rounded mg-loading-icon" aria-hidden="true"
                >progress_activity</span
              >
              <h3>Carregando supervisores</h3>
              <p>Consultando os cadastros locais de teste.</p>
            </div>
          } @else if (loadError()) {
            <div class="mg-empty" role="alert">
              <span class="material-symbols-rounded" aria-hidden="true">error</span>
              <h3>Não foi possível carregar supervisores</h3>
              <p>{{ loadError() }}</p>
              <button type="button" class="btn mg-primary" (click)="load()">
                Tentar novamente
              </button>
            </div>
          } @else if (filtered().length) {
            <div class="mg-list">
              @for (supervisor of filtered(); track supervisor.id) {
                <article class="mg-row">
                  <div class="mg-avatar" aria-hidden="true">{{ supervisor.name.slice(0, 1) }}</div>
                  <div class="mg-row-main">
                    <h3>{{ supervisor.name }}</h3>
                    <p>{{ supervisor.institutionalId }}</p>
                  </div>
                  <div class="mg-row-detail">
                    <strong>Contato institucional</strong><span>{{ supervisor.email }}</span>
                  </div>
                  <a class="mg-row-link" [routerLink]="['/supervisores', supervisor.id]"
                    >Ver detalhes
                    <span class="material-symbols-rounded" aria-hidden="true"
                      >arrow_forward</span
                    ></a
                  >
                </article>
              }
            </div>
          } @else if (supervisors().length === 0) {
            <div class="mg-empty" role="status">
              <span class="material-symbols-rounded" aria-hidden="true">group_off</span>
              <h3>Nenhum supervisor cadastrado</h3>
              <p>
                {{
                  isDemo()
                    ? 'Este é o estado vazio da demonstração.'
                    : 'Cadastre o primeiro supervisor com dados fictícios para testar este fluxo.'
                }}
              </p>
            </div>
          } @else {
            <div class="mg-empty" role="status">
              <span class="material-symbols-rounded" aria-hidden="true">search_off</span>
              <h3>Nenhum supervisor encontrado</h3>
              <p>Confira a busca ou limpe o campo.</p>
              <button class="btn mg-secondary" type="button" (click)="search.setValue('')">
                Limpar busca
              </button>
            </div>
          }
        </section>
        <div class="mg-note">
          <span class="material-symbols-rounded" aria-hidden="true">info</span>
          <p>
            {{
              isDemo()
                ? 'Estes registros são demonstrativos e não criam credenciais.'
                : 'Ambiente local de teste: use apenas dados fictícios. O cadastro funcional não cria credencial ou senha.'
            }}
          </p>
        </div>
      } @else {
        <section class="mg-empty" role="alert">
          <span class="material-symbols-rounded" aria-hidden="true">lock</span>
          <h1>Acesso restrito</h1>
          <p>A gestão de supervisores está disponível para gestor e supervisor.</p>
          <a class="btn mg-primary" routerLink="/inicio">Voltar ao início</a>
        </section>
      }
    </main>
  `,
})
export class SupervisorsComponent {
  readonly service = inject(ManagementDemoService);
  private readonly api = inject(SupervisorApiService);
  private readonly session = inject(DemoSessionService);
  readonly isDemo = this.session.active;
  readonly canEdit = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly scenario = this.session.scenario;
  readonly search = new FormControl('', { nonNullable: true });
  readonly localSupervisors = signal<Supervisor[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly supervisors = computed(() =>
    this.isDemo() ? this.service.supervisors() : this.localSupervisors(),
  );
  private readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  readonly filtered = computed(() => {
    const value = this.query().trim().toLocaleLowerCase('pt-BR');
    return this.supervisors().filter(
      (item) =>
        !value || `${item.name} ${item.institutionalId}`.toLocaleLowerCase('pt-BR').includes(value),
    );
  });

  constructor() {
    if (!this.isDemo() && this.canEdit()) void this.load();
  }

  async load(): Promise<void> {
    if (this.isDemo() || !this.canEdit()) return;
    this.loading.set(true);
    this.loadError.set('');
    try {
      this.localSupervisors.set(await this.api.list());
    } catch (error) {
      this.localSupervisors.set([]);
      this.loadError.set(
        error instanceof SupervisorApiError && error.status === 403
          ? 'Seu perfil não tem permissão para consultar esta equipe.'
          : 'Confira a conexão com o backend local e tente novamente.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  restoreScenario(): void {
    this.session.setScenario('padrao');
  }
}
