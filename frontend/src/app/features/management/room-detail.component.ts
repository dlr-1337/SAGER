import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import {
  AllocationApiService,
  AllocationRecord,
  allocationErrorMessage,
} from './allocation-api.service';
import { HousingMap, RoomRecord, ageGroupLabel } from './housing.models';
import { ManagementDemoService } from './management-demo.service';
import { RoomApiError, RoomApiService, roomLoadError } from './room-api.service';
import { ResidentApiService, ResidentRecord } from './resident-api.service';
import { formattedDate } from './management.utils';

@Component({
  selector: 'app-room-detail',
  styleUrl: './housing.scss',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page mg-narrow">
      @if (!canView()) {
        <section class="mg-empty" role="alert">
          <h1>Acesso restrito</h1>
          <p>O mapa está disponível para gestor e supervisor.</p>
          <a class="btn mg-primary" routerLink="/inicio">Voltar ao início</a>
        </section>
      } @else if (loading()) {
        <section class="mg-empty" role="status" aria-live="polite">
          <span class="material-symbols-rounded mg-loading-icon" aria-hidden="true"
            >progress_activity</span
          >
          <h1>Carregando quarto</h1>
          <p>Aguarde um momento.</p>
        </section>
      } @else if (loadError()) {
        <section class="mg-empty" role="alert">
          <h1>{{ missing() ? 'Quarto não encontrado' : 'Não foi possível carregar o quarto' }}</h1>
          <p>{{ loadError() }}</p>
          @if (sessionRequired()) {
            <a class="btn mg-primary" routerLink="/acesso">Entrar novamente</a>
          } @else if (!missing()) {
            <button type="button" class="btn mg-primary" (click)="load()">Tentar novamente</button>
          }
          <a class="btn mg-secondary" routerLink="/quartos">Voltar ao mapa</a>
        </section>
      } @else if (!isDemo() && localRoom(); as item) {
        <header class="mg-heading">
          <div>
            <a class="mg-back" routerLink="/quartos"
              ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Mapa de
              quartos</a
            >
            <h1>Quarto {{ item.number }}</h1>
            <p>
              {{ accommodationName() }}
              @if (unitName()) {
                · {{ unitName() }}
              }
              @if (item.floor) {
                · {{ item.floor }}
              }
            </p>
          </div>
          @if (canEdit()) {
            <a class="btn mg-primary" [routerLink]="['/quartos', item.id, 'editar']"
              ><span class="material-symbols-rounded" aria-hidden="true">edit</span> Editar
              quarto</a
            >
          }
        </header>
        @if (saved()) {
          <p class="mg-success" role="status">
            <span class="material-symbols-rounded" aria-hidden="true">check_circle</span> Quarto
            salvo.
          </p>
        }
        <section class="panel mg-panel" aria-labelledby="local-room-details-title">
          <h2 id="local-room-details-title">Dados do quarto</h2>
          <dl class="mg-details">
            <div>
              <dt>Código global</dt>
              <dd>{{ item.code }}</dd>
            </div>
            <div>
              <dt>Número</dt>
              <dd>{{ item.number }}</dd>
            </div>
            <div>
              <dt>Alojamento</dt>
              <dd>{{ accommodationName() }}</dd>
            </div>
            <div>
              <dt>Faixa etária</dt>
              <dd>{{ ageGroup() }}</dd>
            </div>
            <div>
              <dt>Casa ou bloco</dt>
              <dd>{{ unitName() ?? 'Sem casa ou bloco' }}</dd>
            </div>
            <div>
              <dt>Piso</dt>
              <dd>{{ item.floor ?? 'Piso não informado' }}</dd>
            </div>
            <div>
              <dt>Capacidade</dt>
              <dd>
                {{
                  item.capacity === null
                    ? 'Capacidade não definida'
                    : item.capacity + (item.capacity === 1 ? ' vaga' : ' vagas')
                }}
              </dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                <span class="mg-situation" [attr.data-situation]="item.situation"
                  ><span class="mg-dot" aria-hidden="true"></span>{{ item.situation }}</span
                >
              </dd>
            </div>
            <div>
              <dt>Ocupação</dt>
              <dd>{{ item.occupancy }} {{ item.occupancy === 1 ? 'morador' : 'moradores' }}</dd>
            </div>
            <div>
              <dt>Vagas livres</dt>
              <dd>{{ item.vacancies === null ? 'Capacidade não definida' : item.vacancies }}</dd>
            </div>
          </dl>
        </section>
        <section class="panel mg-panel" aria-labelledby="local-room-residents-title">
          <h2 id="local-room-residents-title">Moradores atuais</h2>
          @if (occupantsLoading()) {
            <p role="status">Carregando moradores...</p>
          } @else if (occupantsError()) {
            <div class="mg-empty mg-empty-inline" role="alert">
              <h3>Não foi possível carregar moradores</h3>
              <p>{{ occupantsError() }}</p>
              <button type="button" class="btn mg-secondary" (click)="loadOccupants()">
                Tentar novamente
              </button>
            </div>
          } @else if (occupants().length) {
            <div class="mg-list">
              @for (allocation of occupants(); track allocation.id) {
                <article class="mg-row">
                  <div class="mg-avatar" aria-hidden="true">
                    {{ occupantName(allocation.residentId).slice(0, 1) }}
                  </div>
                  <div class="mg-row-main">
                    <h3>{{ occupantName(allocation.residentId) }}</h3>
                    @if (occupantCourse(allocation.residentId); as course) {
                      <p>{{ course }}</p>
                    }
                    <p>{{ occupantDates(allocation) }}</p>
                  </div>
                  <a class="mg-row-link" [routerLink]="['/residentes', allocation.residentId]"
                    >Ver cadastro
                    <span class="material-symbols-rounded" aria-hidden="true"
                      >arrow_forward</span
                    ></a
                  >
                </article>
              }
            </div>
          } @else {
            <div class="mg-empty mg-empty-inline" role="status">
              <h3>Nenhum morador vinculado</h3>
              <p>Este quarto está sem moradores.</p>
            </div>
          }
        </section>
        <div class="mg-note">
          <span class="material-symbols-rounded" aria-hidden="true">info</span>
          <p>
            A situação do quarto é escolhida por você. O quarto não recebe mais moradores do que a
            capacidade.
          </p>
        </div>
      } @else if (isDemo() && room(); as item) {
        <header class="mg-heading">
          <div>
            <a class="mg-back" routerLink="/quartos"
              ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Mapa de
              quartos</a
            >
            <h1>Quarto {{ item.number }}</h1>
            <p>Bloco {{ item.block }} · {{ item.floor }}</p>
          </div>
          @if (canEdit()) {
            <a class="btn mg-primary" [routerLink]="['/quartos', item.id, 'editar']"
              ><span class="material-symbols-rounded" aria-hidden="true">edit</span> Editar
              quarto</a
            >
          }
        </header>
        @if (saved()) {
          <p class="mg-success" role="status">
            <span class="material-symbols-rounded" aria-hidden="true">check_circle</span> Quarto
            salvo nesta demonstração.
          </p>
        }
        <section class="panel mg-panel" aria-labelledby="room-details-title">
          <h2 id="room-details-title">Dados do quarto</h2>
          <dl class="mg-details">
            <div>
              <dt>Número</dt>
              <dd>{{ item.number }}</dd>
            </div>
            <div>
              <dt>Localização</dt>
              <dd>Bloco {{ item.block }} · {{ item.floor }}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                <span class="mg-situation" [attr.data-situation]="item.situation"
                  ><span class="mg-dot" aria-hidden="true"></span>{{ item.situation }}</span
                >
              </dd>
            </div>
            <div>
              <dt>Ocupação</dt>
              <dd>{{ demo.occupancyLabel(item.id) }}</dd>
            </div>
          </dl>
        </section>
        <section class="panel mg-panel" aria-labelledby="room-residents-title">
          <h2 id="room-residents-title">Moradores</h2>
          @if (residents().length) {
            <div class="mg-list">
              @for (resident of residents(); track resident.id) {
                <article class="mg-row">
                  <div class="mg-avatar" aria-hidden="true">{{ resident.name.slice(0, 1) }}</div>
                  <div class="mg-row-main">
                    <h3>{{ resident.name }}</h3>
                    <p>Matrícula {{ resident.enrollment }}</p>
                  </div>
                  <a class="mg-row-link" [routerLink]="['/residentes', resident.id]"
                    >Ver cadastro
                    <span class="material-symbols-rounded" aria-hidden="true"
                      >arrow_forward</span
                    ></a
                  >
                </article>
              }
            </div>
          } @else {
            <div class="mg-empty mg-empty-inline">
              <h3>Nenhum morador vinculado</h3>
              <p>Este quarto está sem moradores.</p>
            </div>
          }
        </section>
        <div class="mg-note">
          <span class="material-symbols-rounded" aria-hidden="true">info</span>
          <p>Estes registros são demonstrativos.</p>
        </div>
      } @else {
        <section class="mg-empty" role="alert">
          <h1>Quarto não encontrado</h1>
          <p>Não encontramos este quarto. Volte ao mapa e tente de novo.</p>
          <a class="btn mg-primary" routerLink="/quartos">Voltar ao mapa</a>
        </section>
      }
    </main>
  `,
})
export class RoomDetailComponent {
  readonly demo = inject(ManagementDemoService);
  private readonly api = inject(RoomApiService);
  private readonly allocationApi = inject(AllocationApiService);
  private readonly residentApi = inject(ResidentApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly isDemo = this.session.active;
  readonly canView = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly canEdit = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly room = computed(() => (this.isDemo() ? this.demo.room(this.id) : undefined));
  readonly residents = computed(() => (this.isDemo() ? this.demo.residentsInRoom(this.id) : []));
  readonly saved = computed(() => this.route.snapshot.queryParamMap.get('saved') === '1');
  readonly localRoom = signal<RoomRecord | null>(null);
  readonly localMap = signal<HousingMap>({ accommodations: [], units: [], rooms: [] });
  readonly occupants = signal<AllocationRecord[]>([]);
  readonly occupantResidents = signal<ResidentRecord[]>([]);
  readonly occupantsLoading = signal(false);
  readonly occupantsError = signal('');
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly missing = signal(false);
  readonly sessionRequired = signal(false);
  readonly ageGroup = computed(() =>
    ageGroupLabel(
      this.localMap().accommodations.find((item) => item.id === this.localRoom()?.accommodationId)
        ?.ageGroup,
    ),
  );
  readonly accommodationName = computed(
    () =>
      this.localMap().accommodations.find((item) => item.id === this.localRoom()?.accommodationId)
        ?.name ?? 'Alojamento não encontrado',
  );
  readonly unitName = computed(
    () => this.localMap().units.find((item) => item.id === this.localRoom()?.unitId)?.name ?? null,
  );

  constructor() {
    if (!this.isDemo() && this.canView()) void this.load();
  }

  async load(): Promise<void> {
    if (this.isDemo() || !this.canView()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.missing.set(false);
    this.sessionRequired.set(false);
    try {
      const map = await this.api.map();
      const item = map.rooms.find((room) => room.id === this.id);
      if (!item) throw new RoomApiError(404);
      this.localRoom.set(item);
      this.localMap.set(map);
      if (!this.destroyRef.destroyed) void this.loadOccupants();
    } catch (error) {
      this.localRoom.set(null);
      this.missing.set(error instanceof RoomApiError && error.status === 404);
      this.sessionRequired.set(error instanceof RoomApiError && [401, 403].includes(error.status));
      this.loadError.set(roomLoadError(error));
    } finally {
      this.loading.set(false);
    }
  }

  async loadOccupants(): Promise<void> {
    if (this.isDemo() || !this.canView()) return;
    this.occupantsLoading.set(true);
    this.occupantsError.set('');
    try {
      const [allocations, { items: residents }] = await Promise.all([
        this.allocationApi.activeInRoom(this.id),
        // Só os moradores deste quarto, em vez da lista inteira de residentes.
        this.residentApi.page({ roomId: this.id }),
      ]);
      if (this.destroyRef.destroyed) return;
      this.occupants.set(allocations);
      this.occupantResidents.set(residents);
    } catch (error) {
      if (this.destroyRef.destroyed) return;
      this.occupants.set([]);
      this.occupantResidents.set([]);
      this.occupantsError.set(allocationErrorMessage(error));
    } finally {
      if (!this.destroyRef.destroyed) this.occupantsLoading.set(false);
    }
  }

  occupantName(residentId: string): string {
    return (
      this.occupantResidents().find((item) => item.id === residentId)?.name ??
      'Residente não encontrado'
    );
  }

  /** Etapa · curso, como o servidor calculou. */
  occupantCourse(residentId: string): string {
    const resident = this.occupantResidents().find((item) => item.id === residentId);
    return resident ? [resident.stage, resident.course].filter(Boolean).join(' · ') : '';
  }

  /** "Entrou em dd/mm/aaaa · saída prevista dd/mm/aaaa", com a entrada no horário de Brasília. */
  occupantDates(allocation: AllocationRecord): string {
    const date = new Date(allocation.startedAt);
    const entered = Number.isNaN(date.getTime())
      ? 'Entrada não informada'
      : 'Entrou em ' +
        new Intl.DateTimeFormat('pt-BR', {
          dateStyle: 'short',
          timeZone: 'America/Sao_Paulo',
        }).format(date);
    const exit = this.occupantResidents().find(
      (item) => item.id === allocation.residentId,
    )?.expectedExit;
    return exit ? `${entered} · saída prevista ${formattedDate(exit)}` : entered;
  }
}
