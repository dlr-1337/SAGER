import { ERROR_FORBIDDEN, ERROR_GENERIC } from '../../core/error-messages';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PaginationComponent } from '../../shared/pagination.component';
import { normalizeSearch } from '../../shared/search';
import { rememberFilters, rememberValue } from '../../core/filter-state';
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
  imports: [PaginationComponent, ReactiveFormsModule, RouterLink],
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
            <p>Veja quem faz parte da equipe.</p>
          </div>
          <a class="btn mg-primary" routerLink="/supervisores/novo"
            ><span class="material-symbols-rounded" aria-hidden="true">person_add</span> Cadastrar
            supervisor</a
          >
        </header>
        <section class="panel mg-panel" aria-labelledby="supervisor-search-title">
          <h2 id="supervisor-search-title">Buscar supervisores</h2>
          <label class="field mg-field"
            >Nome, matrícula ou SIAPE<input
              type="search"
              [formControl]="search"
              placeholder="Digite para buscar"
              autocomplete="off" /></label
          ><button type="button" class="btn mg-secondary" (click)="search.setValue('')">
            Limpar filtros
          </button>
        </section>
        <section class="mg-section" aria-labelledby="supervisor-results-title">
          <div class="mg-section-heading">
            <h2 id="supervisor-results-title" tabindex="-1">Equipe cadastrada</h2>
            <p aria-live="polite">
              @if (isDemo() && scenario() !== 'padrao') {
                Cenário demonstrativo
              } @else if (!loading() && !loadError()) {
                {{
                  total() === 1 ? '1 supervisor encontrado' : total() + ' supervisores encontrados'
                }}
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
              <p>Aguarde um momento.</p>
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
              @for (supervisor of paged(); track supervisor.id) {
                <article class="mg-row">
                  <div class="mg-avatar" aria-hidden="true">{{ supervisor.name.slice(0, 1) }}</div>
                  <div class="mg-row-main">
                    <h3>{{ supervisor.name }}</h3>
                    <p>{{ supervisor.institutionalId }}</p>
                  </div>
                  <div class="mg-row-detail">
                    <strong>E-mail</strong><span>{{ supervisor.email }}</span>
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
                    : 'Cadastre o primeiro supervisor.'
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
          <sager-pagination
            [page]="page()"
            [total]="total()"
            anchor="supervisor-results-title"
            (pageChange)="changePage($event)"
          />
        </section>
        @if (isDemo()) {
          <div class="mg-note">
            <span class="material-symbols-rounded" aria-hidden="true">info</span>
            <p>Estes registros são demonstrativos.</p>
          </div>
        }
      } @else {
        <section class="mg-empty" role="alert">
          <span class="material-symbols-rounded" aria-hidden="true">lock</span>
          <h1>Acesso restrito</h1>
          <p>A gestão de supervisores está disponível só para o gestor.</p>
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
  readonly canEdit = computed(() => this.session.hasRole('gestor'));
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
    if (!this.isDemo()) return this.localSupervisors();
    const value = normalizeSearch(this.query());
    return this.supervisors().filter(
      (item) =>
        !value ||
        normalizeSearch(`${item.name} ${item.institutionalId} ${item.email}`).includes(value),
    );
  });

  readonly remoteTotal = signal(0);
  readonly total = computed(() => (this.isDemo() ? this.filtered().length : this.remoteTotal()));
  readonly page = rememberValue('supervisors.component.ts-page', 0);
  readonly paged = computed(() =>
    this.isDemo()
      ? this.filtered().slice(this.page() * 25, (this.page() + 1) * 25)
      : this.filtered(),
  );

  constructor() {
    rememberFilters('supervisors', this.search);
    // A página volta ao início na hora: esperar a pausa desfazia um clique em "Próxima".
    this.search.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.page.set(0));
    this.search.valueChanges.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => {
      if (!this.isDemo()) void this.load();
    });
    if (this.isDemo()) {
      const lastPage = Math.max(0, Math.ceil(this.filtered().length / 25) - 1);
      this.page.update((page) => Math.max(0, Math.min(page, lastPage)));
    } else if (this.canEdit()) void this.load();
  }

  private generation = 0;
  changePage(page: number): void {
    this.page.set(page);
    if (!this.isDemo()) void this.load();
  }
  async load(): Promise<void> {
    if (this.isDemo() || !this.canEdit()) return;
    const generation = ++this.generation;
    this.loading.set(true);
    this.loadError.set('');
    try {
      const result = await this.api.page({
        search: this.search.value,
        limit: '25',
        offset: String(this.page() * 25),
      });
      if (generation !== this.generation) return;
      this.localSupervisors.set(result.items);
      this.remoteTotal.set(result.total);
      if (this.page() && this.page() * 25 >= result.total) {
        this.changePage(Math.max(0, Math.ceil(result.total / 25) - 1));
      }
    } catch (error) {
      if (generation !== this.generation) return;
      this.localSupervisors.set([]);
      this.loadError.set(
        error instanceof SupervisorApiError && error.status === 403
          ? ERROR_FORBIDDEN
          : ERROR_GENERIC,
      );
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }

  restoreScenario(): void {
    this.session.setScenario('padrao');
  }
}
