import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';
import { Room, RoomSituation } from './management.models';

interface RoomGroup { block: string; floor: string; rooms: Room[] }

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page">
      @if (canView()) {
        <header class="mg-heading"><div><a class="mg-back" routerLink="/inicio"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Início</a><h1>Mapa de quartos</h1><p>Consulte a situação e a ocupação por bloco e piso.</p></div>@if (canEdit()) { <a class="btn mg-primary" routerLink="/quartos/novo"><span class="material-symbols-rounded" aria-hidden="true">add</span> Cadastrar quarto</a> }</header>
        <section class="panel mg-panel" aria-labelledby="room-filter-heading"><h2 id="room-filter-heading">Filtrar mapa</h2><form class="mg-filters" [formGroup]="filters">
          <label class="field mg-field">Bloco<select formControlName="block"><option value="">Todos os blocos</option>@for (block of blocks(); track block) { <option [value]="block">Bloco {{ block }}</option> }</select></label>
          <label class="field mg-field">Piso<select formControlName="floor"><option value="">Todos os pisos</option>@for (floor of floors(); track floor) { <option [value]="floor">{{ floor }}</option> }</select></label>
          <label class="field mg-field">Situação<select formControlName="situation"><option value="">Todas as situações</option>@for (situation of situations; track situation) { <option [value]="situation">{{ situation }}</option> }</select></label>
        </form></section>
        <div class="mg-legend" aria-label="Legenda do mapa de quartos"><span class="mg-legend-title">Legenda</span>@for (situation of situations; track situation) { <span class="mg-legend-item" [attr.data-situation]="situation"><span class="mg-dot" aria-hidden="true"></span>{{ situation }}</span> }</div>
        <section class="mg-section" aria-labelledby="room-map-heading"><div class="mg-section-heading"><h2 id="room-map-heading">Quartos</h2><p aria-live="polite">@if (scenario() === 'padrao') { {{ filteredRooms().length }} de {{ service.rooms().length }} quartos } @else { Cenário demonstrativo }</p></div>
          @if (scenario() === 'carregando') { <div class="mg-empty" role="status" aria-live="polite"><span class="material-symbols-rounded mg-loading-icon" aria-hidden="true">progress_activity</span><h3>Carregando mapa de quartos</h3><p>Este é um estado simulado para revisão da interface.</p><button type="button" class="btn mg-secondary" (click)="restoreScenario()">Voltar ao cenário padrão</button></div> }
          @else if (scenario() === 'erro') { <div class="mg-empty" role="alert"><span class="material-symbols-rounded" aria-hidden="true">error</span><h3>Não foi possível carregar os quartos</h3><p>Falha simulada. Tente novamente para voltar aos dados de demonstração.</p><button type="button" class="btn mg-primary" (click)="restoreScenario()">Tentar novamente</button></div> }
          @else if (scenario() === 'vazio') { <div class="mg-empty" role="status"><span class="material-symbols-rounded" aria-hidden="true">meeting_room</span><h3>Nenhum quarto cadastrado</h3><p>Este é o estado vazio da demonstração.</p><button type="button" class="btn mg-secondary" (click)="restoreScenario()">Voltar ao cenário padrão</button></div> }
          @else if (groups().length) {
            @for (group of groups(); track group.block + group.floor) {
              <section class="mg-room-group" [attr.aria-label]="'Bloco ' + group.block + ', ' + group.floor"><h3>Bloco {{ group.block }} <span>{{ group.floor }}</span></h3><div class="mg-room-grid">
                @for (room of group.rooms; track room.id) {
                  <a class="mg-room-tile" [attr.data-situation]="room.situation" [routerLink]="['/quartos', room.id]" [attr.aria-label]="'Quarto ' + room.number + ', bloco ' + room.block + ', ' + room.floor + ', ' + room.situation + ', ' + service.occupancyLabel(room.id)">
                    <span class="mg-room-top"><strong>Quarto {{ room.number }}</strong><span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></span>
                    <span class="mg-room-status"><span class="mg-dot" aria-hidden="true"></span>{{ room.situation }}</span>
                    <span class="mg-room-meta">{{ service.occupancyLabel(room.id) }} <span aria-hidden="true">·</span> Limpeza: {{ room.cleaningScore === null ? 'sem avaliação' : 'nota ' + room.cleaningScore.toLocaleString('pt-BR') }}</span>
                  </a>
                }
              </div></section>
            }
          } @else { <div class="mg-empty" role="status"><span class="material-symbols-rounded" aria-hidden="true">meeting_room</span><h3>Nenhum quarto encontrado</h3><p>Altere os filtros para ver outros blocos e pisos.</p><button type="button" class="btn mg-secondary" (click)="clearFilters()">Limpar filtros</button></div> }
        </section>
        <div class="mg-note"><span class="material-symbols-rounded" aria-hidden="true">info</span><p>A situação do quarto é registrada separadamente da quantidade de moradores. Regras de capacidade e alocação ainda dependem de definição da AE.</p></div>
      } @else { <section class="mg-empty" role="alert"><h1>Acesso restrito</h1><p>O mapa está disponível para gestor e supervisor.</p><a class="btn mg-primary" routerLink="/inicio">Voltar ao início</a></section> }
    </main>
  `,
})
export class RoomsComponent {
  readonly service = inject(ManagementDemoService);
  private readonly session = inject(DemoSessionService);
  readonly canView = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly canEdit = computed(() => this.session.hasRole('gestor'));
  readonly scenario = this.session.scenario;
  readonly situations: RoomSituation[] = ['Disponível', 'Ocupado', 'Manutenção', 'Indisponível'];
  readonly filters = new FormGroup({
    block: new FormControl('', { nonNullable: true }),
    floor: new FormControl('', { nonNullable: true }),
    situation: new FormControl('', { nonNullable: true }),
  });
  private readonly criteria = toSignal(this.filters.valueChanges, { initialValue: this.filters.getRawValue() });
  readonly blocks = computed(() => [...new Set(this.service.rooms().map((room) => room.block))].sort());
  readonly floors = computed(() => [...new Set(this.service.rooms().map((room) => room.floor))].sort());
  readonly filteredRooms = computed(() => {
    const { block, floor, situation } = this.criteria();
    return this.service.rooms().filter((room) => (!block || room.block === block) && (!floor || room.floor === floor) && (!situation || room.situation === situation));
  });
  readonly groups = computed<RoomGroup[]>(() => {
    const result = new Map<string, RoomGroup>();
    for (const room of this.filteredRooms()) {
      const key = `${room.block}|${room.floor}`;
      if (!result.has(key)) result.set(key, { block: room.block, floor: room.floor, rooms: [] });
      result.get(key)!.rooms.push(room);
    }
    return [...result.values()].sort((a, b) => a.block.localeCompare(b.block) || floorPosition(a.floor) - floorPosition(b.floor));
  });

  clearFilters(): void {
    this.filters.reset({ block: '', floor: '', situation: '' });
  }

  restoreScenario(): void {
    this.session.setScenario('padrao');
  }
}

function floorPosition(floor: string): number {
  if (floor === 'Térreo') return 0;
  const number = Number.parseInt(floor, 10);
  return Number.isNaN(number) ? Number.MAX_SAFE_INTEGER : number;
}
