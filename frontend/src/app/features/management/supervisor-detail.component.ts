import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ManagementDemoService } from './management-demo.service';

@Component({
  selector: 'app-supervisor-detail',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page mg-narrow">
      @if (supervisor(); as item) {
        <header class="mg-heading"><div><a class="mg-back" routerLink="/supervisores"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Supervisores</a><h1>{{ item.name }}</h1><p>Equipe de supervisão da residência</p></div><a class="btn mg-primary" [routerLink]="['/supervisores', item.id, 'editar']"><span class="material-symbols-rounded" aria-hidden="true">edit</span> Editar supervisor</a></header>
        @if (saved()) { <p class="mg-success" role="status"><span class="material-symbols-rounded" aria-hidden="true">check_circle</span> Supervisor salvo nesta demonstração.</p> }
        <section class="panel mg-panel" aria-labelledby="supervisor-data-title"><h2 id="supervisor-data-title">Dados funcionais</h2><dl class="mg-details"><div><dt>Nome completo</dt><dd>{{ item.name }}</dd></div><div><dt>Identificação institucional</dt><dd>{{ item.institutionalId }}</dd></div><div><dt>E-mail institucional</dt><dd>{{ item.email }}</dd></div><div><dt>Unidade</dt><dd>IF Goiano · Campus Urutaí</dd></div></dl></section>
        <div class="mg-note"><span class="material-symbols-rounded" aria-hidden="true">info</span><p>O cadastro demonstrativo não cria credenciais. A autenticação institucional será integrada pela TI.</p></div>
      } @else { <section class="mg-empty" role="alert"><h1>Supervisor não encontrado</h1><p>O cadastro solicitado não está disponível nesta demonstração.</p><a class="btn mg-primary" routerLink="/supervisores">Voltar à equipe</a></section> }
    </main>
  `,
})
export class SupervisorDetailComponent {
  private readonly service = inject(ManagementDemoService);
  private readonly route = inject(ActivatedRoute);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly supervisor = computed(() => this.service.supervisor(this.id));
  readonly saved = signal(this.route.snapshot.queryParamMap.get('saved') === '1');
}
