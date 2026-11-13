import { PaginationComponent } from '../../shared/pagination.component';
import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { normalizeSearch } from '../../shared/search';
import { rememberFilters, rememberValue } from '../../core/filter-state';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { HousingMap } from './housing.models';
import { ManagementDemoService } from './management-demo.service';
import { RoomSituation } from './management.models';
import { RoomApiError, RoomApiService, roomLoadError } from './room-api.service';

interface MapRoom {
  id: string;
  number: string;
  code: string | null;
  accommodationId: string;
  accommodationName: string;
  unitId: string | null;
  unitName: string | null;
  floor: string | null;
  situation: RoomSituation;
  capacity: number | null;
  occupancy: number | null;
  vacancies: number | null;
  occupancyLabel: string;
}

interface RoomGroup {
  key: string;
  name: string;
  unit: string | null;
  floor: string;
  rooms: MapRoom[];
}

@Component({
  selector: 'app-rooms',
  styleUrl: './housing.scss',
  standalone: true,
  imports: [PaginationComponent, SearchableSelectDirective, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page">
      @if (canView()) {
        <header class="mg-heading">
          <div>
            <a class="mg-back" routerLink="/inicio"
              ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Início</a
            >
            <h1>Mapa de quartos</h1>
            <p>
              {{
                isDemo()
                  ? 'Consulte a situação e a ocupação por bloco e piso.'
                  : 'Veja onde fica cada quarto, quantas vagas tem e a situação dele.'
              }}
            </p>
          </div>
          @if (canEdit() || !isDemo()) {
            <div class="action-row mg-actions">
              @if (!isDemo()) {
                <a class="btn mg-secondary" routerLink="/alojamentos">{{
                  canEdit() ? 'Gerenciar alojamentos' : 'Ver alojamentos'
                }}</a>
              }
              @if (canEdit()) {
                <a class="btn mg-primary" routerLink="/quartos/novo"
                  ><span class="material-symbols-rounded" aria-hidden="true">add</span> Cadastrar
                  quarto</a
                >
              }
            </div>
          }
        </header>
        <section class="panel mg-panel" aria-labelledby="room-filter-heading">
          <h2 id="room-filter-heading">Filtrar mapa</h2>
          <form class="mg-filters" [formGroup]="filters">
            <label class="field mg-field mg-grow"
              >Buscar quarto, código ou bloco<input type="search" formControlName="search"
            /></label>
            @if (isDemo()) {
              <label class="field mg-field"
                >Bloco<select sagerSearchable formControlName="block">
                  <option value="">Todos os blocos</option>
                  @for (block of blocks(); track block) {
                    <option [value]="block">Bloco {{ block }}</option>
                  }
                </select></label
              >
            } @else {
              <label class="field mg-field"
                >Alojamento<select sagerSearchable formControlName="accommodationId">
                  <option value="">Todos os alojamentos</option>
                  @for (item of localMap().accommodations; track item.id) {
                    <option [value]="item.id">{{ item.name }}</option>
                  }
                </select></label
              >
              <label class="field mg-field"
                >Casa ou bloco<select sagerSearchable formControlName="unitId">
                  <option value="">Todas as casas e blocos</option>
                  @for (item of units(); track item.id) {
                    <option [value]="item.id">{{ item.name }}</option>
                  }
                </select></label
              >
            }
            <label class="field mg-field"
              >Piso<select sagerSearchable formControlName="floor">
                <option value="">Todos os pisos</option>
                @for (floor of floors(); track floor) {
                  <option [value]="floor">{{ floor }}</option>
                }
              </select></label
            >
            <label class="field mg-field"
              >Situação<select sagerSearchable formControlName="situation">
                <option value="">Todas as situações</option>
                @for (situation of situations; track situation) {
                  <option [value]="situation">{{ situation }}</option>
                }
              </select></label
            >
            @if (!isDemo()) {
              <label class="field mg-field"
                >Ocupação<select sagerSearchable formControlName="occupancy">
                  <option value="">Todas as ocupações</option>
                  <option value="with-residents">Com moradores</option>
                  <option value="empty">Sem moradores</option>
                  <option value="with-vacancies">Com vagas</option>
                  <option value="full">Lotados</option>
                  <option value="unknown">Capacidade não definida</option>
                </select></label
              >
            }
          </form>
        </section>
        <div class="mg-legend" aria-label="Legenda do mapa de quartos">
          <span class="mg-legend-title">Legenda</span>
          @for (situation of situations; track situation) {
            <span class="mg-legend-item" [attr.data-situation]="situation"
              ><span class="mg-dot" aria-hidden="true"></span>{{ situation }}</span
            >
          }
        </div>
        <section class="mg-section" aria-labelledby="room-map-heading">
          <div class="mg-section-heading">
            <h2 id="room-map-heading">Quartos</h2>
            <p aria-live="polite">
              @if (!loading() && !loadError() && scenario() === 'padrao') {
                {{ filteredRooms().length }} de {{ rooms().length }} quartos
              } @else if (isDemo()) {
                Cenário demonstrativo
              }
            </p>
          </div>
          @if (loading() || scenario() === 'carregando') {
            <div class="mg-empty" role="status" aria-live="polite">
              <span class="material-symbols-rounded mg-loading-icon" aria-hidden="true"
                >progress_activity</span
              >
              <h3>Carregando mapa de quartos</h3>
              <p>
                {{
                  isDemo()
                    ? 'Este é um estado simulado para revisão da interface.'
                    : 'Aguarde um momento.'
                }}
              </p>
              @if (isDemo()) {
                <button type="button" class="btn mg-secondary" (click)="restoreScenario()">
                  Voltar ao cenário padrão
                </button>
              }
            </div>
          } @else if (loadError() || scenario() === 'erro') {
            <div class="mg-empty" role="alert">
              <span class="material-symbols-rounded" aria-hidden="true">error</span>
              <h3>Não foi possível carregar os quartos</h3>
              <p>
                {{
                  isDemo()
                    ? 'Falha simulada. Tente novamente para voltar aos dados de demonstração.'
                    : loadError()
                }}
              </p>
              @if (sessionRequired()) {
                <a class="btn mg-primary" routerLink="/acesso">Entrar novamente</a>
              } @else {
                <button type="button" class="btn mg-primary" (click)="retry()">
                  Tentar novamente
                </button>
              }
            </div>
          } @else if (scenario() === 'vazio' || !rooms().length) {
            <div class="mg-empty" role="status">
              <span class="material-symbols-rounded" aria-hidden="true">meeting_room</span>
              <h3>Nenhum quarto cadastrado</h3>
              <p>
                {{
                  isDemo()
                    ? 'Este é o estado vazio da demonstração.'
                    : 'Cadastre os alojamentos e quartos para montar o mapa.'
                }}
              </p>
              @if (isDemo()) {
                <button type="button" class="btn mg-secondary" (click)="restoreScenario()">
                  Voltar ao cenário padrão
                </button>
              }
            </div>
          } @else if (groups().length) {
            @if (!isDemo()) {
              <dl class="mg-stats" aria-live="polite">
                <div>
                  <dt>Capacidade cadastrada</dt>
                  <dd>{{ totals().known ? totals().capacity : 'Não definida' }}</dd>
                </div>
                <div>
                  <dt>Moradores</dt>
                  <dd>{{ totals().people }}</dd>
                </div>
                <div>
                  <dt>Vagas livres</dt>
                  <dd>{{ totals().known ? totals().vacancies : 'Não definidas' }}</dd>
                </div>
              </dl>
              @if (totals().missing && totals().known) {
                <p class="mg-muted">
                  Capacidade e vagas em soma parcial; {{ totals().missing }}
                  {{ totals().missing === 1 ? 'quarto sem capacidade' : 'quartos sem capacidade' }}.
                </p>
              }
            }
            @for (group of groups(); track group.key) {
              <section
                class="mg-room-group"
                [attr.aria-label]="
                  group.name + (group.unit ? ', ' + group.unit : '') + ', ' + group.floor
                "
              >
                <h3>
                  {{ group.name }}
                  @if (group.unit) {
                    <span>{{ group.unit }}</span>
                  }
                  <span>{{ group.floor }}</span>
                </h3>
                <div class="mg-room-grid">
                  @for (room of group.rooms; track room.id) {
                    <a
                      class="mg-room-tile"
                      [attr.data-situation]="room.situation"
                      [routerLink]="['/quartos', room.id]"
                      [attr.aria-label]="roomLabel(room)"
                    >
                      <span class="mg-room-top"
                        ><strong>Quarto {{ room.number }}</strong
                        ><span class="material-symbols-rounded" aria-hidden="true"
                          >arrow_forward</span
                        ></span
                      >
                      @if (room.code) {
                        <span class="mg-room-meta">Código {{ room.code }}</span>
                      }
                      <span class="mg-room-status"
                        ><span class="mg-dot" aria-hidden="true"></span>{{ room.situation }}</span
                      >
                      <span class="mg-room-meta">
                        @if (!isDemo()) {
                          {{ capacityLabel(room.capacity) }}<br />
                        }
                        {{ room.occupancyLabel }}</span
                      >
                    </a>
                  }
                </div>
              </section>
            }
          } @else {
            <div class="mg-empty" role="status">
              <span class="material-symbols-rounded" aria-hidden="true">meeting_room</span>
              <h3>Nenhum quarto encontrado</h3>
              <p>Altere os filtros para ver outras localizações e situações.</p>
              <button type="button" class="btn mg-secondary" (click)="clearFilters()">
                Limpar filtros
              </button>
            </div>
          }
        </section>
        <div class="mg-note">
          <span class="material-symbols-rounded" aria-hidden="true">info</span>
          <p>
            {{
              isDemo()
                ? 'Estes registros são demonstrativos. A situação do quarto é registrada separadamente da quantidade de moradores.'
                : 'O número de moradores vem dos cadastros. A situação do quarto é escolhida por você.'
            }}
          </p>
        </div>
      } @else {
        <section class="mg-empty" role="alert">
          <h1>Acesso restrito</h1>
          <p>O mapa está disponível para gestor e supervisor.</p>
          <a class="btn mg-primary" routerLink="/inicio">Voltar ao início</a>
        </section>
      }
      @if (canView() && !loading() && !loadError()) {
        <sager-pagination
          [page]="page()"
          [total]="filteredRooms().length"
          (pageChange)="page.set($event)"
        />
      }
    </main>
  `,
})
export class RoomsComponent {
  private readonly demo = inject(ManagementDemoService);
  private readonly api = inject(RoomApiService);
  private readonly session = inject(DemoSessionService);
  readonly isDemo = this.session.active;
  readonly canView = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly canEdit = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly scenario = computed(() => (this.isDemo() ? this.session.scenario() : 'padrao'));
  readonly situations: RoomSituation[] = ['Disponível', 'Ocupado', 'Manutenção', 'Indisponível'];
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly sessionRequired = signal(false);
  readonly localMap = signal<HousingMap>({ accommodations: [], units: [], rooms: [] });
  readonly page = rememberValue('rooms.component.ts-page', 0);
  readonly filters = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    block: new FormControl('', { nonNullable: true }),
    accommodationId: new FormControl('', { nonNullable: true }),
    unitId: new FormControl('', { nonNullable: true }),
    floor: new FormControl('', { nonNullable: true }),
    situation: new FormControl('', { nonNullable: true }),
    occupancy: new FormControl('', { nonNullable: true }),
  });
  private readonly criteria = toSignal(this.filters.valueChanges, {
    initialValue: this.filters.getRawValue(),
  });
  readonly units = computed(() =>
    this.localMap().units.filter(
      (item) =>
        !this.criteria().accommodationId ||
        item.accommodationId === this.criteria().accommodationId,
    ),
  );
  readonly rooms = computed<MapRoom[]>(() => {
    if (this.isDemo())
      return this.demo.rooms().map((item) => ({
        ...item,
        code: null,
        accommodationId: item.block,
        accommodationName: `Bloco ${item.block}`,
        unitId: null,
        unitName: null,
        capacity: null,
        occupancy: null,
        vacancies: null,
        occupancyLabel: this.demo.occupancyLabel(item.id),
      }));
    const map = this.localMap();
    return map.rooms.map((item) => ({
      ...item,
      accommodationName:
        map.accommodations.find((value) => value.id === item.accommodationId)?.name ?? '',
      unitName: map.units.find((value) => value.id === item.unitId)?.name ?? null,
      occupancyLabel: `${item.occupancy} ${item.occupancy === 1 ? 'morador' : 'moradores'}${item.vacancies === null ? ' · vagas não definidas' : ` · ${item.vacancies} ${item.vacancies === 1 ? 'vaga livre' : 'vagas livres'}`}`,
    }));
  });
  readonly blocks = computed(() =>
    [...new Set(this.rooms().map((room) => room.accommodationId))].sort(),
  );
  readonly floors = computed(() =>
    [
      ...new Set(
        this.rooms()
          .map((room) => room.floor)
          .filter((floor): floor is string => floor !== null),
      ),
    ].sort((a, b) => floorPosition(a) - floorPosition(b) || a.localeCompare(b)),
  );
  readonly filteredRooms = computed(() => {
    const { search, block, accommodationId, unitId, floor, situation, occupancy } = this.criteria();
    return this.rooms().filter(
      (room) =>
        normalizeSearch(
          `${room.number} ${room.code ?? ''} ${room.accommodationName} ${room.unitName ?? ''}`,
        ).includes(normalizeSearch(search)) &&
        (!this.isDemo() || !block || room.accommodationId === block) &&
        (this.isDemo() || !accommodationId || room.accommodationId === accommodationId) &&
        (this.isDemo() || !unitId || room.unitId === unitId) &&
        (!floor || room.floor === floor) &&
        (!situation || room.situation === situation) &&
        (this.isDemo() ||
          !occupancy ||
          (occupancy === 'with-residents' && (room.occupancy ?? 0) > 0) ||
          (occupancy === 'empty' && room.occupancy === 0) ||
          (occupancy === 'with-vacancies' && room.vacancies !== null && room.vacancies > 0) ||
          (occupancy === 'full' && room.capacity !== null && room.vacancies === 0) ||
          (occupancy === 'unknown' && room.capacity === null)),
    );
  });
  readonly groups = computed<RoomGroup[]>(() => {
    const result = new Map<string, RoomGroup>();
    for (const room of this.filteredRooms().slice(this.page() * 25, (this.page() + 1) * 25)) {
      const key = JSON.stringify([room.accommodationId, room.unitId, room.floor]);
      if (!result.has(key))
        result.set(key, {
          key,
          name: room.accommodationName,
          unit: room.unitName,
          floor: room.floor ?? 'Piso não informado',
          rooms: [],
        });
      result.get(key)!.rooms.push(room);
    }
    return [...result.values()].sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        (a.unit ?? '').localeCompare(b.unit ?? '') ||
        floorPosition(a.floor) - floorPosition(b.floor) ||
        a.floor.localeCompare(b.floor),
    );
  });
  // vacancies é null exatamente quando capacity é null (validado em room-api.service).
  readonly totals = computed(() => {
    const rooms = this.filteredRooms();
    const known = rooms.filter((room) => room.capacity !== null);
    return {
      known: known.length,
      missing: rooms.length - known.length,
      capacity: known.reduce((total, room) => total + (room.capacity ?? 0), 0),
      people: rooms.reduce((total, room) => total + (room.occupancy ?? 0), 0),
      vacancies: known.reduce((total, room) => total + (room.vacancies ?? 0), 0),
    };
  });

  constructor() {
    rememberFilters('rooms', this.filters);
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.page.set(0));
    this.filters.controls.accommodationId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.filters.controls.unitId.setValue(''));
    if (this.isDemo()) {
      const lastPage = Math.max(0, Math.ceil(this.filteredRooms().length / 25) - 1);
      this.page.update((page) => Math.max(0, Math.min(page, lastPage)));
    } else if (this.canView()) void this.load();
  }

  async load(): Promise<void> {
    if (this.isDemo() || !this.canView()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.sessionRequired.set(false);
    try {
      this.localMap.set(await this.api.map());
      const lastPage = Math.max(0, Math.ceil(this.filteredRooms().length / 25) - 1);
      this.page.update((page) => Math.max(0, Math.min(page, lastPage)));
    } catch (error) {
      this.localMap.set({ accommodations: [], units: [], rooms: [] });
      this.loadError.set(roomLoadError(error));
      this.sessionRequired.set(error instanceof RoomApiError && [401, 403].includes(error.status));
    } finally {
      this.loading.set(false);
    }
  }

  capacityLabel(capacity: number | null): string {
    return capacity === null
      ? 'Capacidade não definida'
      : `Capacidade: ${capacity} ${capacity === 1 ? 'vaga' : 'vagas'}`;
  }
  roomLabel(room: MapRoom): string {
    return `Quarto ${room.number}, ${room.code ? `código ${room.code}, ` : ''}${room.accommodationName}${room.unitName ? `, ${room.unitName}` : ''}, ${room.floor ?? 'piso não informado'}, ${room.situation}, ${!this.isDemo() ? `${this.capacityLabel(room.capacity)}, ` : ''}${room.occupancyLabel}`;
  }
  clearFilters(): void {
    this.page.set(0);
    this.filters.reset({
      search: '',
      block: '',
      accommodationId: '',
      unitId: '',
      floor: '',
      situation: '',
      occupancy: '',
    });
  }
  restoreScenario(): void {
    this.session.setScenario('padrao');
  }
  retry(): void {
    if (this.isDemo()) this.restoreScenario();
    else void this.load();
  }
}

function floorPosition(floor: string): number {
  if (floor === 'Térreo') return 0;
  const number = Number.parseInt(floor, 10);
  return Number.isNaN(number) ? Number.MAX_SAFE_INTEGER : number;
}
