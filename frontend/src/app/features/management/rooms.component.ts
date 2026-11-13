import { PaginationComponent } from '../../shared/pagination.component';
import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { FilterChip, FilterPanelComponent } from '../../shared/filter-panel.component';
import { normalizeSearch } from '../../shared/search';
import { rememberFilters, rememberValue } from '../../core/filter-state';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { HousingMap, compareFloors, compareNatural, unitsIn } from './housing.models';
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

interface Place {
  id: string;
  name: string;
  rooms: number;
  vacancies: number;
}

// Manutenção e Indisponível não recebem alocação (RN15): as camas livres deles não são vagas.
const receives = (room: MapRoom) =>
  room.situation !== 'Manutenção' && room.situation !== 'Indisponível';
const freeVacancies = (rooms: MapRoom[]) =>
  rooms.reduce((total, room) => total + (receives(room) ? (room.vacancies ?? 0) : 0), 0);

@Component({
  selector: 'app-rooms',
  styleUrl: './housing.scss',
  standalone: true,
  imports: [
    PaginationComponent,
    SearchableSelectDirective,
    FilterPanelComponent,
    ReactiveFormsModule,
    RouterLink,
  ],
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
        <sager-filter-panel
          heading="Buscar quartos"
          key="rooms"
          [chips]="chips()"
          (remove)="removeFilter($event)"
          (clear)="clearFilters()"
        >
          <div filterMain class="mg-filters" [formGroup]="filters">
            <label class="field mg-field mg-grow"
              >Buscar quarto, código ou bloco<input type="search" formControlName="search"
            /></label>
          </div>
          <div class="mg-filters" [formGroup]="filters">
            @if (isDemo()) {
              <label class="field mg-field"
                >Bloco<select sagerSearchable formControlName="block">
                  <option value="">Todos os blocos</option>
                  @for (block of blocks(); track block) {
                    <option [value]="block">Bloco {{ block }}</option>
                  }
                </select></label
              >
            }
            @if (floors().length) {
              <label class="field mg-field"
                >Piso<select sagerSearchable formControlName="floor">
                  <option value="">Todos os pisos</option>
                  @for (floor of floors(); track floor) {
                    <option [value]="floor">{{ floor }}</option>
                  }
                </select></label
              >
            }
            <label class="field mg-field"
              >Situação<select sagerSearchable formControlName="situation">
                <option value="">Todas as situações</option>
                @for (situation of situations; track situation) {
                  <option [value]="situation">{{ situation }}</option>
                }
              </select></label
            >
            @if (!isDemo()) {
              <label class="mg-check"
                ><input type="checkbox" formControlName="vacancies" /> Só com vagas</label
              >
            }
          </div>
        </sager-filter-panel>
        @if (!isDemo() && !loading() && !loadError() && rooms().length) {
          <nav class="mg-trail" aria-label="Trilha dos quartos">
            <ol>
              @for (step of trail(); track $index; let first = $first, last = $last) {
                <li>
                  @if (!first) {
                    <span class="mg-trail-sep" aria-hidden="true">›</span>
                  }
                  @if (last) {
                    <span aria-current="location">{{ step.label }}</span>
                  } @else {
                    <button type="button" (click)="go(step.accommodationId, '')">
                      {{ step.label }}
                    </button>
                  }
                </li>
              }
            </ol>
          </nav>
        }
        <section class="mg-section" aria-labelledby="room-map-heading">
          <div class="mg-section-heading">
            <h2 id="room-map-heading" tabindex="-1">{{ title() }}</h2>
            <p aria-live="polite">
              @if (!loading() && !loadError() && scenario() === 'padrao') {
                @if (places().length) {
                  {{ placeCount() }}
                } @else {
                  {{ filteredRooms().length }} de {{ rooms().length }} quartos
                }
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
          } @else {
            @if (places().length) {
              <div class="mg-room-grid">
                @for (place of places(); track place.id) {
                  <button type="button" class="mg-place-tile" (click)="open(place.id)">
                    <span class="mg-room-top"
                      ><strong>{{ place.name }}</strong
                      ><span class="material-symbols-rounded" aria-hidden="true"
                        >arrow_forward</span
                      ></span
                    >
                    <span class="mg-room-meta"
                      >{{ place.rooms }} {{ place.rooms === 1 ? 'quarto' : 'quartos' }} ·
                      {{ place.vacancies }}
                      {{ place.vacancies === 1 ? 'vaga livre' : 'vagas livres' }}</span
                    >
                  </button>
                }
              </div>
              @if (groups().length) {
                <h3 class="mg-subheading">Quartos fora de casa ou bloco</h3>
              }
            }
            @if (groups().length) {
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
                    {{
                      totals().missing === 1 ? 'quarto sem capacidade' : 'quartos sem capacidade'
                    }}.
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
              <sager-pagination
                [page]="page()"
                [total]="filteredRooms().length"
                anchor="room-map-heading"
                (pageChange)="page.set($event)"
              />
              @if (isDemo()) {
                <div class="mg-legend" aria-label="Legenda do mapa de quartos">
                  <span class="mg-legend-title">Legenda</span>
                  @for (situation of situations; track situation) {
                    <span class="mg-legend-item" [attr.data-situation]="situation"
                      ><span class="mg-dot" aria-hidden="true"></span>{{ situation }}</span
                    >
                  }
                </div>
              } @else {
                <section class="mg-legend-list" aria-labelledby="room-legend-title">
                  <h3 id="room-legend-title">Legenda</h3>
                  <dl>
                    @for (item of legend; track item.situation) {
                      <div [attr.data-situation]="item.situation">
                        <dt><span class="mg-dot" aria-hidden="true"></span>{{ item.situation }}</dt>
                        <dd>{{ item.text }}</dd>
                      </div>
                    }
                  </dl>
                </section>
              }
            } @else if (!places().length) {
              <div class="mg-empty" role="status">
                <span class="material-symbols-rounded" aria-hidden="true">meeting_room</span>
                @if (filtering()) {
                  <h3>Nenhum quarto encontrado</h3>
                  <p>Altere os filtros para ver outras localizações e situações.</p>
                  <button type="button" class="btn mg-secondary" (click)="clearFilters()">
                    Limpar filtros
                  </button>
                } @else {
                  <h3>Nenhum quarto neste local</h3>
                  <p>Este local ainda não tem quartos cadastrados. Volte pela trilha.</p>
                }
              </div>
            }
          }
        </section>
        <div class="mg-note">
          <span class="material-symbols-rounded" aria-hidden="true">info</span>
          <p>
            {{
              isDemo()
                ? 'Estes registros são demonstrativos. A situação do quarto é registrada separadamente da quantidade de moradores.'
                : 'Disponível e Ocupado mudam sozinhos com os moradores. Manutenção e Indisponível são escolhidos no cadastro do quarto.'
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
    </main>
  `,
})
export class RoomsComponent {
  private readonly demo = inject(ManagementDemoService);
  private readonly api = inject(RoomApiService);
  private readonly session = inject(DemoSessionService);
  private readonly injector = inject(Injector);
  readonly isDemo = this.session.active;
  readonly canView = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly canEdit = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly scenario = computed(() => (this.isDemo() ? this.session.scenario() : 'padrao'));
  readonly situations: RoomSituation[] = ['Disponível', 'Ocupado', 'Manutenção', 'Indisponível'];
  readonly legend: { situation: RoomSituation; text: string }[] = [
    {
      situation: 'Disponível',
      text: 'Tem vaga e recebe residentes. Muda sozinha com os moradores.',
    },
    {
      situation: 'Ocupado',
      text: 'Todas as vagas estão preenchidas. Muda sozinha com os moradores.',
    },
    {
      situation: 'Manutenção',
      text: 'Em reparo, não recebe novos residentes. Escolhida pelo gestor ou supervisor.',
    },
    {
      situation: 'Indisponível',
      text: 'Fora de uso, não recebe novos residentes. Escolhida pelo gestor ou supervisor, ou quando o quarto não tem capacidade definida.',
    },
  ];
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
    vacancies: new FormControl(false, { nonNullable: true }),
  });
  // Valor completo a cada mudança: os controles não são nulos nem desativados.
  private readonly criteria = toSignal(
    this.filters.valueChanges.pipe(map(() => this.filters.getRawValue())),
    { initialValue: this.filters.getRawValue() },
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
    [...new Set(this.rooms().map((room) => room.accommodationId))].sort(compareNatural),
  );
  readonly floors = computed(() =>
    [
      ...new Set(
        this.rooms()
          .map((room) => room.floor)
          .filter((floor): floor is string => floor !== null),
      ),
    ].sort(compareFloors),
  );
  /** Busca, piso, situação ou vagas ativos: a tela mostra a grade do escopo do nível. */
  readonly filtering = computed(() => {
    const { search, floor, situation, vacancies } = this.criteria();
    return !!(search || floor || situation || vacancies);
  });
  /** Nível pela navegação: sem alojamento, alojamentos; com casas e sem casa, casas; senão, quartos. */
  readonly level = computed<'accommodations' | 'units' | 'rooms'>(() => {
    const { accommodationId, unitId } = this.criteria();
    if (!accommodationId) return 'accommodations';
    return !unitId && unitsIn(this.localMap(), accommodationId).length ? 'units' : 'rooms';
  });
  private readonly scoped = computed(() => {
    const { search, block, accommodationId, unitId, floor, situation, vacancies } = this.criteria();
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
        (this.isDemo() || !vacancies || (receives(room) && (room.vacancies ?? 0) > 0)),
    );
  });
  /** Quartos da grade, paginados de 25 em 25. */
  readonly filteredRooms = computed(() => {
    if (this.isDemo() || this.filtering()) return this.scoped();
    const level = this.level();
    if (level === 'accommodations') return [];
    return level === 'units' ? this.scoped().filter((room) => room.unitId === null) : this.scoped();
  });
  readonly places = computed<Place[]>(() => {
    if (this.isDemo() || this.filtering() || this.level() === 'rooms') return [];
    const map = this.localMap();
    const rooms = this.rooms();
    const accommodationId = this.criteria().accommodationId;
    const items = accommodationId
      ? unitsIn(map, accommodationId).map((unit) => ({
          ...unit,
          inside: rooms.filter((room) => room.unitId === unit.id),
        }))
      : map.accommodations.map((item) => ({
          ...item,
          inside: rooms.filter((room) => room.accommodationId === item.id),
        }));
    return items.map(({ id, name, inside }) => ({
      id,
      name,
      rooms: inside.length,
      vacancies: freeVacancies(inside),
    }));
  });
  readonly placeCount = computed(() => {
    const count = this.places().length;
    if (this.level() === 'accommodations')
      return `${count} ${count === 1 ? 'alojamento' : 'alojamentos'}`;
    return `${count} ${count === 1 ? 'casa ou bloco' : 'casas ou blocos'}`;
  });
  readonly trail = computed(() => {
    const map = this.localMap();
    const { accommodationId, unitId } = this.criteria();
    const steps = [{ label: 'Quartos', accommodationId: '' }];
    const accommodation = map.accommodations.find((item) => item.id === accommodationId);
    if (accommodation) steps.push({ label: accommodation.name, accommodationId });
    const unit = map.units.find((item) => item.id === unitId);
    if (accommodation && unit) steps.push({ label: unit.name, accommodationId });
    return steps;
  });
  readonly title = computed(() => {
    if (this.isDemo()) return 'Quartos';
    const steps = this.trail();
    return steps.length > 1
      ? steps[steps.length - 1].label
      : this.places().length
        ? 'Alojamentos'
        : 'Quartos';
  });
  readonly groups = computed<RoomGroup[]>(() => {
    const result = new Map<string, RoomGroup>();
    // A ordem é a do mapa (natural), então os grupos saem na ordem de chegada.
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
    return [...result.values()];
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
      vacancies: freeVacancies(known),
    };
  });
  readonly chips = computed<FilterChip[]>(() => {
    const { search, block, floor, situation, vacancies } = this.criteria();
    const chips: [string, string, string | false][] = [
      ['search', 'Busca', search],
      ['block', 'Bloco', this.isDemo() && !!block && `Bloco ${block}`],
      ['floor', 'Piso', floor],
      ['situation', 'Situação', situation],
      ['vacancies', 'Só com vagas', !this.isDemo() && vacancies && 'Sim'],
    ];
    return chips
      .filter((chip): chip is [string, string, string] => !!chip[2])
      .map(([key, label, value]) => ({ key, label, value }));
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
      const map = await this.api.map();
      this.localMap.set(map);
      // Nível lembrado de um local que deixou de existir volta ao anterior.
      const { accommodationId, unitId } = this.filters.controls;
      if (accommodationId.value && !map.accommodations.some((a) => a.id === accommodationId.value))
        accommodationId.setValue('');
      if (unitId.value && !unitsIn(map, accommodationId.value).some((u) => u.id === unitId.value))
        unitId.setValue('');
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

  /** Abre o cartão escolhido: alojamento no primeiro nível, casa ou bloco no segundo. */
  open(id: string): void {
    if (this.level() === 'accommodations') this.go(id, '');
    else this.go(this.criteria().accommodationId, id);
  }

  /** Muda de nível e leva o foco ao título do nível exibido. */
  go(accommodationId: string, unitId: string): void {
    this.filters.controls.accommodationId.setValue(accommodationId);
    this.filters.controls.unitId.setValue(unitId);
    afterNextRender(() => document.getElementById('room-map-heading')?.focus(), {
      injector: this.injector,
    });
  }

  capacityLabel(capacity: number | null): string {
    return capacity === null
      ? 'Capacidade não definida'
      : `Capacidade: ${capacity} ${capacity === 1 ? 'vaga' : 'vagas'}`;
  }
  roomLabel(room: MapRoom): string {
    return `Quarto ${room.number}, ${room.code ? `código ${room.code}, ` : ''}${room.accommodationName}${room.unitName ? `, ${room.unitName}` : ''}, ${room.floor ?? 'piso não informado'}, ${room.situation}, ${!this.isDemo() ? `${this.capacityLabel(room.capacity)}, ` : ''}${room.occupancyLabel}`;
  }
  removeFilter(key: string): void {
    const control = this.filters.get(key);
    control?.setValue(key === 'vacancies' ? false : '');
  }
  /** Limpa busca e filtros, sem mudar o nível. */
  clearFilters(): void {
    this.page.set(0);
    this.filters.patchValue({ search: '', block: '', floor: '', situation: '', vacancies: false });
  }
  restoreScenario(): void {
    this.session.setScenario('padrao');
  }
  retry(): void {
    if (this.isDemo()) this.restoreScenario();
    else void this.load();
  }
}
