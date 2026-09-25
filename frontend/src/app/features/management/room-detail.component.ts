import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';

@Component({
  selector: 'app-room-detail',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page mg-narrow">
      @if (!canView()) { <section class="mg-empty" role="alert"><h1>Acesso restrito</h1><p>O mapa está disponível para gestor e supervisor.</p><a class="btn mg-primary" routerLink="/inicio">Voltar ao início</a></section> }
      @else if (room(); as item) {
        <header class="mg-heading"><div><a class="mg-back" routerLink="/quartos"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Mapa de quartos</a><h1>Quarto {{ item.number }}</h1><p>Bloco {{ item.block }} · {{ item.floor }}</p></div>@if (canEdit()) { <a class="btn mg-primary" [routerLink]="['/quartos', item.id, 'editar']"><span class="material-symbols-rounded" aria-hidden="true">edit</span> Editar quarto</a> }</header>
        @if (saved()) { <p class="mg-success" role="status"><span class="material-symbols-rounded" aria-hidden="true">check_circle</span> Quarto salvo nesta demonstração.</p> }
        <section class="panel mg-panel" aria-labelledby="room-details-title"><h2 id="room-details-title">Dados do quarto</h2><dl class="mg-details"><div><dt>Número</dt><dd>{{ item.number }}</dd></div><div><dt>Localização</dt><dd>Bloco {{ item.block }} · {{ item.floor }}</dd></div><div><dt>Situação</dt><dd><span class="mg-situation" [attr.data-situation]="item.situation"><span class="mg-dot" aria-hidden="true"></span>{{ item.situation }}</span></dd></div><div><dt>Ocupação</dt><dd>{{ service.occupancyLabel(item.id) }}</dd></div><div><dt>Última nota de limpeza</dt><dd>{{ item.cleaningScore === null ? 'Sem avaliação' : item.cleaningScore.toLocaleString('pt-BR') }}</dd></div></dl></section>
        <section class="panel mg-panel" aria-labelledby="room-residents-title"><h2 id="room-residents-title">Moradores</h2>
          @if (residents().length) { <div class="mg-list">@for (resident of residents(); track resident.id) { <article class="mg-row"><div class="mg-avatar" aria-hidden="true">{{ resident.name.slice(0, 1) }}</div><div class="mg-row-main"><h3>{{ resident.name }}</h3><p>Matrícula {{ resident.enrollment }}</p></div><a class="mg-row-link" [routerLink]="['/residentes', resident.id]">Ver cadastro <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></a></article> }</div> }
          @else { <div class="mg-empty mg-empty-inline"><h3>Nenhum morador vinculado</h3><p>A alocação de residentes será definida pela AE.</p></div> }
        </section>
        <div class="mg-note"><span class="material-symbols-rounded" aria-hidden="true">info</span><p>A alteração de moradores, a capacidade máxima e as regras de disponibilidade ainda precisam de definição institucional.</p></div>
      } @else { <section class="mg-empty" role="alert"><h1>Quarto não encontrado</h1><p>O registro solicitado não está disponível nesta demonstração.</p><a class="btn mg-primary" routerLink="/quartos">Voltar ao mapa</a></section> }
    </main>
  `,
})
export class RoomDetailComponent {
  readonly service = inject(ManagementDemoService);
  private readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly canView = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly canEdit = computed(() => this.session.hasRole('gestor'));
  readonly room = computed(() => this.service.room(this.id));
  readonly residents = computed(() => this.service.residentsInRoom(this.id));
  readonly saved = computed(() => this.route.snapshot.queryParamMap.get('saved') === '1');
}
