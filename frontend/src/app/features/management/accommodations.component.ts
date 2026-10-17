import { debounceTime } from 'rxjs';
import { AccommodationApiService } from './accommodation-api.service';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { normalizeSearch } from '../../shared/search';
import { rememberFilters, rememberValue } from '../../core/filter-state';
import { PaginationComponent } from '../../shared/pagination.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { accommodationErrorMessage } from './accommodation-api.service';
import { AccommodationDataService } from './accommodation-data.service';
import { Accommodation } from './housing.models';

@Component({
  selector: 'app-accommodations',
  styleUrl: './housing.scss',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, PaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page">
      <header class="mg-heading">
        <div>
          <a class="mg-back" routerLink="/quartos"
            ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Mapa de
            quartos</a
          >
          <h1>Alojamentos</h1>
          <p>Organize residências e suas casas ou blocos.</p>
        </div>
        @if (canEdit()) {
          <a class="btn mg-primary" routerLink="/alojamentos/novo"
            ><span class="material-symbols-rounded" aria-hidden="true">add</span> Cadastrar
            alojamento</a
          >
        }
      </header>
      <section class="panel mg-panel">
        <label class="field mg-field"
          >Buscar por nome ou código<input type="search" [formControl]="search" /></label
        ><button class="btn mg-secondary" (click)="search.setValue('')">Limpar filtros</button>
        <p role="status">{{ total() }} alojamento(s)</p>
      </section>
      @if (loading()) {
        <section class="mg-empty" role="status" aria-live="polite">
          <h2>Carregando alojamentos</h2>
          <p>Consultando os cadastros.</p>
        </section>
      } @else if (error()) {
        <section class="mg-empty" role="alert">
          <h2>Não foi possível carregar os alojamentos</h2>
          <p>{{ error() }}</p>
          <button class="btn mg-primary" type="button" (click)="load()">Tentar novamente</button
          ><a class="mg-back" routerLink="/acesso">Acesso local</a>
        </section>
      } @else if (!items().length) {
        <section class="mg-empty" role="status">
          <span class="material-symbols-rounded" aria-hidden="true">domain</span>
          <h2>Nenhum alojamento cadastrado</h2>
          <p>O mapa começa vazio. Cadastre um alojamento antes de adicionar quartos.</p>
        </section>
      } @else {
        <section class="panel mg-panel" aria-labelledby="accommodation-list-title">
          <h2 id="accommodation-list-title">Alojamentos cadastrados</h2>
          <div class="mg-list">
            @for (item of paged(); track item.id) {
              <article class="mg-row">
                <div class="mg-avatar" aria-hidden="true">
                  <span class="material-symbols-rounded">domain</span>
                </div>
                <div class="mg-row-main">
                  <h3>{{ item.name }}</h3>
                  <p>Código {{ item.code }}</p>
                </div>
                <a class="mg-row-link" [routerLink]="['/alojamentos', item.id]"
                  >Ver alojamento
                  <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></a
                >
              </article>
            } @empty {
              <p role="status">Nenhum alojamento corresponde à busca.</p>
            }
          </div>
          <sager-pagination [page]="page()" [total]="total()" (pageChange)="changePage($event)" />
        </section>
      }
      <div class="mg-note">
        <span class="material-symbols-rounded" aria-hidden="true">info</span>
        <p>
          {{
            isDemo()
              ? 'Estes cadastros são fictícios e permanecem somente nesta demonstração.'
              : 'Ambiente local de teste: use apenas dados fictícios. Moradores e vagas livres ainda não estão integrados.'
          }}
        </p>
      </div>
    </main>
  `,
})
export class AccommodationsComponent {
  private readonly data = inject(AccommodationDataService);
  private readonly api = inject(AccommodationApiService);
  readonly remoteTotal = signal(0);
  readonly total = computed(() => (this.isDemo() ? this.filtered().length : this.remoteTotal()));
  private readonly session = inject(DemoSessionService);
  readonly canEdit = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly isDemo = this.session.active;
  readonly items = signal<Accommodation[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly search = new FormControl('', { nonNullable: true });
  private readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  readonly page = rememberValue('accommodations.component.ts-page', 0);
  readonly filtered = computed(() =>
    this.isDemo()
      ? this.items()
          .filter((a) =>
            normalizeSearch(`${a.name} ${a.code}`).includes(normalizeSearch(this.query())),
          )
          .sort(
            (a, b) =>
              Number(normalizeSearch(b.code) === normalizeSearch(this.query())) -
                Number(normalizeSearch(a.code) === normalizeSearch(this.query())) ||
              a.name.localeCompare(b.name, 'pt-BR') ||
              a.id.localeCompare(b.id),
          )
      : this.items(),
  );
  readonly paged = computed(() =>
    this.isDemo()
      ? this.filtered().slice(this.page() * 25, (this.page() + 1) * 25)
      : this.filtered(),
  );
  constructor() {
    rememberFilters('accommodations', this.search);
    this.search.valueChanges.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => {
      this.page.set(0);
      if (!this.isDemo()) void this.load();
    });
    void this.load();
  }
  private generation = 0;
  changePage(page: number): void {
    this.page.set(page);
    if (!this.isDemo()) void this.load();
  }
  async load(): Promise<void> {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      if (this.isDemo()) {
        this.items.set(await this.data.list());
        const lastPage = Math.max(0, Math.ceil(this.filtered().length / 25) - 1);
        this.page.update((page) => Math.max(0, Math.min(page, lastPage)));
      } else {
        const result = await this.api.page({
          search: this.search.value,
          limit: '25',
          offset: String(this.page() * 25),
        });
        if (generation !== this.generation) return;
        this.items.set(result.items);
        this.remoteTotal.set(result.total);
        if (this.page() && this.page() * 25 >= result.total) {
          this.changePage(Math.max(0, Math.ceil(result.total / 25) - 1));
        }
      }
    } catch (error) {
      if (generation !== this.generation) return;
      this.items.set([]);
      this.error.set(accommodationErrorMessage(error));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
}
