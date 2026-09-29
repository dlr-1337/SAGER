import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';
import { Supervisor } from './management.models';
import { SupervisorApiError, SupervisorApiService } from './supervisor-api.service';

@Component({
  selector: 'app-supervisor-detail',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page mg-narrow">
      @if (loading()) {
        <section class="mg-empty" role="status" aria-live="polite">
          <span class="material-symbols-rounded mg-loading-icon" aria-hidden="true"
            >progress_activity</span
          >
          <h1>Carregando supervisor</h1>
          <p>Consultando o cadastro local de teste.</p>
        </section>
      } @else if (loadError()) {
        <section class="mg-empty" role="alert">
          <h1>
            {{ missing() ? 'Supervisor não encontrado' : 'Não foi possível carregar o supervisor' }}
          </h1>
          <p>{{ loadError() }}</p>
          @if (!missing()) {
            <button type="button" class="btn mg-primary" (click)="load()">Tentar novamente</button>
          }
          <a class="btn mg-secondary" routerLink="/supervisores">Voltar à equipe</a>
        </section>
      } @else if (supervisor(); as item) {
        <header class="mg-heading">
          <div>
            <a class="mg-back" routerLink="/supervisores"
              ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
              Supervisores</a
            >
            <h1>{{ item.name }}</h1>
            <p>Equipe de supervisão da residência</p>
          </div>
          <a class="btn mg-primary" [routerLink]="['/supervisores', item.id, 'editar']"
            ><span class="material-symbols-rounded" aria-hidden="true">edit</span> Editar
            supervisor</a
          >
        </header>
        @if (saved()) {
          <p class="mg-success" role="status">
            <span class="material-symbols-rounded" aria-hidden="true">check_circle</span>
            {{
              isDemo()
                ? 'Supervisor salvo nesta demonstração.'
                : 'Supervisor salvo no ambiente local de teste.'
            }}
          </p>
        }
        <section class="panel mg-panel" aria-labelledby="supervisor-data-title">
          <h2 id="supervisor-data-title">Dados funcionais</h2>
          <dl class="mg-details">
            <div>
              <dt>Nome completo</dt>
              <dd>{{ item.name }}</dd>
            </div>
            <div>
              <dt>Identificação institucional</dt>
              <dd>{{ item.institutionalId }}</dd>
            </div>
            <div>
              <dt>E-mail institucional</dt>
              <dd>{{ item.email }}</dd>
            </div>
            <div>
              <dt>Unidade</dt>
              <dd>IF Goiano · Campus Urutaí</dd>
            </div>
          </dl>
        </section>
        <div class="mg-note">
          <span class="material-symbols-rounded" aria-hidden="true">info</span>
          <p>
            {{
              isDemo()
                ? 'O cadastro demonstrativo não cria credenciais.'
                : 'Ambiente local de teste: use apenas dados fictícios. Este cadastro não cria credenciais.'
            }}
          </p>
        </div>
      } @else {
        <section class="mg-empty" role="alert">
          <h1>Supervisor não encontrado</h1>
          <p>
            O cadastro solicitado não está disponível
            {{ isDemo() ? 'nesta demonstração' : 'no ambiente local de teste' }}.
          </p>
          <a class="btn mg-primary" routerLink="/supervisores">Voltar à equipe</a>
        </section>
      }
    </main>
  `,
})
export class SupervisorDetailComponent {
  private readonly demo = inject(ManagementDemoService);
  private readonly api = inject(SupervisorApiService);
  private readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly isDemo = this.session.active;
  readonly localSupervisor = signal<Supervisor | null>(null);
  readonly supervisor = computed(() =>
    this.isDemo() ? this.demo.supervisor(this.id) : (this.localSupervisor() ?? undefined),
  );
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly missing = signal(false);
  readonly saved = signal(this.route.snapshot.queryParamMap.get('saved') === '1');

  constructor() {
    if (!this.isDemo()) void this.load();
  }

  async load(): Promise<void> {
    if (this.isDemo()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.missing.set(false);
    try {
      this.localSupervisor.set(await this.api.get(this.id));
    } catch (error) {
      this.localSupervisor.set(null);
      this.missing.set(error instanceof SupervisorApiError && error.status === 404);
      this.loadError.set(
        this.missing()
          ? 'O cadastro solicitado não está disponível no ambiente local de teste.'
          : 'Confira a conexão com o backend local e tente novamente.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
