import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { FilterState, rememberFilters } from '../../core/filter-state';
import { normalizeSearch } from '../../shared/search';
import { PaginationComponent } from '../../shared/pagination.component';
import { ManagementDemoService } from './management-demo.service';
import { ResidentApiError, ResidentApiService, ResidentRecord } from './resident-api.service';
import { Course, CourseApiService } from './course-api.service';
import { RoomApiService } from './room-api.service';
import { HousingMap } from './housing.models';

@Component({
  selector: 'app-residents',
  standalone: true,
  imports: [SearchableSelectDirective, RouterLink, ReactiveFormsModule, PaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <main class="page mg-page">
    <header class="mg-heading">
      <div>
        <a class="mg-back" routerLink="/inicio">Início</a>
        <h1>Residentes</h1>
        <p>Encontre um cadastro, confira vínculos e consulte o histórico.</p>
      </div>
      <a class="btn mg-primary" routerLink="/residentes/novo">Cadastrar residente</a>
    </header>
    <section class="panel mg-panel" aria-labelledby="resident-search-title">
      <h2 id="resident-search-title">Buscar residentes</h2>
      <form class="mg-filters" [formGroup]="filters" (submit)="$event.preventDefault()">
        <label class="field mg-field mg-grow"
          >Nome, matrícula ou e-mail<input
            type="search"
            formControlName="search"
            placeholder="Digite o nome ou matrícula"
            maxlength="200"
            autocomplete="off"
        /></label>
        <label class="field mg-field"
          >Curso<select sagerSearchable formControlName="courseId">
            <option value="">Todos os cursos</option>
            @for (c of courses(); track c.id) {
              <option [value]="c.id">{{ c.name }}{{ c.active ? '' : ' (inativo)' }}</option>
            }
          </select></label
        >
        <label class="field mg-field"
          >{{ isDemo() ? 'Bloco' : 'Alojamento'
          }}<select sagerSearchable formControlName="accommodationId">
            <option value="">Todos</option>
            @if (isDemo()) {
              @for (block of blocks(); track block) {
                <option [value]="block">Bloco {{ block }}</option>
              }
            } @else {
              @for (a of housing().accommodations; track a.id) {
                <option [value]="a.id">{{ a.name }}</option>
              }
            }
          </select></label
        >
        <label class="field mg-field"
          >Quarto<select sagerSearchable formControlName="roomId">
            <option value="">Todos os quartos</option>
            @if (isDemo()) {
              @for (r of service.rooms(); track r.id) {
                <option [value]="r.id">{{ r.block }} · {{ r.number }}</option>
              }
            } @else {
              @for (r of rooms(); track r.id) {
                <option [value]="r.id">{{ r.code }} · {{ r.number }}</option>
              }
            }
          </select></label
        >
        <label class="field mg-field"
          >Alocação<select sagerSearchable formControlName="allocated">
            <option value="">Todas</option>
            <option value="true">Com quarto</option>
            <option value="false">Sem quarto</option>
          </select></label
        >
        <button class="btn mg-secondary" type="button" (click)="clearFilters()">
          Limpar filtros
        </button>
      </form>
      @if (applied().length) {
        <ul class="filter-chips" aria-label="Filtros aplicados">
          @for (chip of applied(); track chip.key) {
            <li>
              <button
                type="button"
                (click)="removeFilter(chip.key)"
                [attr.aria-label]="'Remover filtro ' + chip.label"
              >
                {{ chip.label }}: {{ chip.value }}
                <span class="material-symbols-rounded" aria-hidden="true">close</span>
              </button>
            </li>
          }
        </ul>
      }
      @if (optionsError()) {
        <p role="alert">{{ optionsError() }}</p>
        <button class="btn mg-secondary" (click)="loadOptions()">Recarregar opções</button>
      }
    </section>
    <section class="mg-section" aria-labelledby="resident-results-title">
      <div class="mg-section-heading">
        <h2 id="resident-results-title">Cadastros</h2>
        <p role="status">{{ total() }} residentes encontrados</p>
      </div>
      @if (loading() || (isDemo() && scenario() === 'carregando')) {
        <div class="mg-empty" role="status">
          <h3>Carregando residentes</h3>
          @if (isDemo()) {
            <button class="btn mg-secondary" (click)="restoreScenario()">
              Voltar ao cenário padrão
            </button>
          }
        </div>
      } @else if (loadError() || (isDemo() && scenario() === 'erro')) {
        <div class="mg-empty" role="alert">
          <h3>Não foi possível carregar residentes</h3>
          <p>{{ loadError() }}</p>
          <button class="btn" (click)="isDemo() ? restoreScenario() : load()">
            Tentar novamente
          </button>
        </div>
      } @else if ((isDemo() && scenario() === 'vazio') || !total()) {
        <div class="mg-empty" role="status">
          <h3>
            {{ applied().length ? 'Nenhum residente encontrado' : 'Nenhum residente cadastrado' }}
          </h3>
          <p>
            {{
              applied().length
                ? 'Altere os filtros ou confira a matrícula digitada.'
                : 'Cadastre um residente para começar.'
            }}
          </p>
          <button class="btn mg-secondary" (click)="clearFilters(); restoreScenario()">
            Limpar filtros
          </button>
        </div>
      } @else {
        <div class="mg-list">
          @for (resident of visible(); track resident.id) {
            <article class="mg-row">
              <div class="mg-avatar" aria-hidden="true">{{ resident.name.slice(0, 1) }}</div>
              <div class="mg-row-main">
                <h3>{{ resident.name }}</h3>
                <p>Matrícula {{ resident.enrollment }}</p>
                @if (resident.institutionalEmail) {
                  <p>{{ resident.institutionalEmail }}</p>
                }
              </div>
              <div class="mg-row-detail">
                <strong>Curso</strong><span>{{ resident.course || 'Não informado' }}</span>
              </div>
              <a class="mg-row-link" [routerLink]="['/residentes', resident.id]"
                >Ver cadastro
                <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></a
              >
            </article>
          }
        </div>
      }
      <sager-pagination
        [page]="page()"
        [total]="total()"
        [busy]="loading()"
        (pageChange)="changePage($event)"
      />
    </section>
  </main>`,
})
export class ResidentsComponent {
  readonly service = inject(ManagementDemoService);
  private readonly api = inject(ResidentApiService);
  private readonly courseApi = inject(CourseApiService);
  private readonly roomApi = inject(RoomApiService);
  private readonly session = inject(DemoSessionService);
  private readonly destroy = inject(DestroyRef);
  private readonly memory = inject(FilterState);
  readonly isDemo = this.session.active;
  readonly scenario = this.session.scenario;
  readonly courses = signal<Course[]>([]);
  readonly housing = signal<HousingMap>({ accommodations: [], units: [], rooms: [] });
  readonly optionsError = signal('');
  readonly filters = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    courseId: new FormControl('', { nonNullable: true }),
    accommodationId: new FormControl('', { nonNullable: true }),
    roomId: new FormControl('', { nonNullable: true }),
    allocated: new FormControl('', { nonNullable: true }),
  });
  private readonly criteria = toSignal(this.filters.valueChanges, {
    initialValue: this.filters.getRawValue(),
  });
  readonly page = signal(Number(this.memory.values.get('resident-page') ?? 0));
  readonly items = signal<ResidentRecord[]>([]);
  readonly remoteTotal = signal(0);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly blocks = computed(() => [...new Set(this.service.rooms().map((r) => r.block))].sort());
  readonly rooms = computed(() =>
    this.housing().rooms.filter(
      (r) =>
        !this.criteria().accommodationId || r.accommodationId === this.criteria().accommodationId,
    ),
  );
  readonly applied = computed(() =>
    Object.entries(this.criteria())
      .filter(([, value]) => !!value)
      .map(([key, value]) => ({
        key,
        label: (
          {
            search: 'Busca',
            courseId: 'Curso',
            accommodationId: 'Alojamento',
            roomId: 'Quarto',
            allocated: 'Alocação',
          } as Record<string, string>
        )[key],
        value:
          key === 'courseId'
            ? (this.courses().find((c) => c.id === value)?.name ?? value)
            : key === 'accommodationId'
              ? (this.housing().accommodations.find((a) => a.id === value)?.name ?? value)
              : key === 'roomId'
                ? (this.housing().rooms.find((r) => r.id === value)?.code ??
                  this.service.room(value ?? '')?.number ??
                  value)
                : key === 'allocated'
                  ? value === 'true'
                    ? 'Com quarto'
                    : 'Sem quarto'
                  : value,
      })),
  );
  readonly demoFiltered = computed(() => {
    const c = this.criteria();
    const query = normalizeSearch(c.search);
    const course = this.courses().find((item) => item.id === c.courseId)?.name;
    return this.service
      .residents()
      .filter(
        (r) =>
          normalizeSearch(`${r.name} ${r.enrollment} ${r.institutionalEmail ?? ''}`).includes(
            query,
          ) &&
          (!c.courseId || r.course === course) &&
          (!c.roomId || r.roomId === c.roomId) &&
          (!c.accommodationId || this.service.room(r.roomId ?? '')?.block === c.accommodationId) &&
          (!c.allocated || !!r.roomId === (c.allocated === 'true')),
      )
      .sort(
        (a, b) =>
          Number(normalizeSearch(b.enrollment) === query) -
            Number(normalizeSearch(a.enrollment) === query) ||
          a.name.localeCompare(b.name, 'pt-BR') ||
          a.id.localeCompare(b.id),
      );
  });
  readonly total = computed(() =>
    this.isDemo() ? this.demoFiltered().length : this.remoteTotal(),
  );
  readonly visible = computed<ResidentRecord[]>(() =>
    this.isDemo()
      ? this.demoFiltered().slice(this.page() * 25, (this.page() + 1) * 25)
      : this.items(),
  );
  private request?: AbortController;
  constructor() {
    rememberFilters('residents', this.filters);
    this.filters.valueChanges.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => {
      this.page.set(0);
      this.memory.values.set('resident-page', 0);
      if (!this.isDemo()) void this.load();
    });
    this.filters.controls.accommodationId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.filters.controls.roomId.setValue(''));
    this.destroy.onDestroy(() => this.request?.abort());
    void this.loadOptions();
    if (!this.isDemo()) void this.load();
  }
  async loadOptions(): Promise<void> {
    this.optionsError.set('');
    try {
      const courses = await this.courseApi.list();
      if (this.destroy.destroyed) return;
      this.courses.set(courses);
      if (this.isDemo()) {
        const lastPage = Math.max(0, Math.ceil(this.demoFiltered().length / 25) - 1);
        this.changePage(Math.max(0, Math.min(this.page(), lastPage)));
      } else {
        const map = await this.roomApi.map();
        if (!this.destroy.destroyed) this.housing.set(map);
      }
    } catch {
      if (!this.destroy.destroyed)
        this.optionsError.set('Não foi possível carregar todas as opções de curso e alojamento.');
    }
  }
  async load(): Promise<void> {
    this.request?.abort();
    const request = (this.request = new AbortController());
    this.loading.set(true);
    this.loadError.set('');
    const params = Object.fromEntries(
      Object.entries(this.filters.getRawValue()).filter(([, value]) => value),
    );
    try {
      const result = await this.api.page(
        { ...params, limit: '25', offset: String(this.page() * 25) },
        request.signal,
      );
      if (request.signal.aborted || this.destroy.destroyed) return;
      this.items.set(result.items);
      this.remoteTotal.set(result.total);
      if (this.page() && this.page() * 25 >= result.total) {
        this.changePage(Math.max(0, Math.ceil(result.total / 25) - 1));
      }
    } catch (error) {
      if (request.signal.aborted || this.destroy.destroyed) return;
      this.items.set([]);
      this.remoteTotal.set(0);
      this.loadError.set(
        error instanceof ResidentApiError && [401, 403].includes(error.status)
          ? 'Sua sessão não permite consultar estes cadastros.'
          : 'Confira a conexão e tente novamente.',
      );
    } finally {
      if (!request.signal.aborted && !this.destroy.destroyed) this.loading.set(false);
    }
  }
  changePage(page: number): void {
    this.page.set(page);
    this.memory.values.set('resident-page', page);
    if (!this.isDemo()) void this.load();
  }
  removeFilter(key: string): void {
    this.filters.get(key)?.setValue('');
  }
  clearFilters(): void {
    this.filters.reset({
      search: '',
      courseId: '',
      accommodationId: '',
      roomId: '',
      allocated: '',
    });
    this.changePage(0);
  }
  restoreScenario(): void {
    this.session.setScenario('padrao');
  }
}
