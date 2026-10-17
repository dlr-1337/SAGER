import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { UnsavedFormDirective } from '../../shared/unsaved-form';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DemoSessionService } from '../../core/demo-session.service';
import { ApiError, HealthApiService, healthErrorMessage } from './health-api.service';
import {
  HealthCapabilities,
  HealthCategory,
  HealthNoteSummary,
  HealthResident,
  allCategories,
  categoriesFor,
  categoryLabels,
  professionLabels,
} from './health.models';
import { downloadHealthExport, plainHealthText, trimmedLength } from './health.helpers';
import { HealthNoteListComponent } from './health-note-list.component';
import { HealthNoteDetailComponent } from './health-note-detail.component';

export { HealthAccessPage } from './health-access.page';

abstract class LocalHealthState {
  protected readonly api = inject(HealthApiService);
  protected readonly destroy = inject(DestroyRef);
  protected readonly session = inject(DemoSessionService);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly me = signal<HealthCapabilities | null>(null);
  readonly categories = categoryLabels;
  readonly allCategories = allCategories;
  readonly professions = professionLabels;
  protected async capabilities(): Promise<HealthCapabilities> {
    if (this.session.active()) throw new ApiError(403);
    return firstValueFrom(this.api.getMe());
  }
}

@Component({
  selector: 'app-health-residents',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './health.scss',
  template: `
    <main class="page health-page">
      <header class="page-header health-heading">
        <div>
          <h1>Saúde</h1>
          <p>Consulte os residentes com vínculo assistencial vigente para sua conta.</p>
        </div>
        @if (me()?.canAdministerAccess) {
          <a class="btn-secondary" routerLink="/saude/acessos">Administrar acessos</a>
        }
      </header>
      @if (me()?.professionalGrant; as grant) {
        <p class="health-meta">
          {{ professions[grant.profession] }} · Registro {{ grant.registrationNumber }}/{{
            grant.registrationRegion
          }}
        </p>
      }
      @if (loading()) {
        <p role="status">Carregando residentes assistidos…</p>
      }
      @if (error()) {
        <p class="health-alert" role="alert">{{ error() }}</p>
        <button type="button" class="btn-secondary" [disabled]="loading()" (click)="load()">
          Tentar novamente
        </button>
      }
      @if (me()?.professionalGrant && !error()) {
        <section class="panel health-section" aria-labelledby="health-residents-title">
          <h2 id="health-residents-title">Residentes assistidos</h2>
          <form class="health-filter" (submit)="$event.preventDefault(); load()">
            <div class="field">
              <label for="health-resident-search">Buscar por nome ou matrícula</label
              ><input
                id="health-resident-search"
                type="search"
                [formControl]="query"
                maxlength="200"
              />
            </div>
            <button type="submit" class="btn" [disabled]="loading()">Buscar residentes</button>
          </form>
          <p class="health-meta health-section" role="status">
            {{ total() }} {{ total() === 1 ? 'residente disponível' : 'residentes disponíveis' }}
          </p>
          <ul class="health-list">
            @for (resident of residents(); track resident.id) {
              <li class="health-row">
                <div>
                  <h3>{{ resident.name }}</h3>
                  <p class="health-meta">Matrícula {{ resident.enrollment }}</p>
                </div>
                <a
                  class="btn-secondary"
                  [routerLink]="['/saude/residentes', resident.id]"
                  [attr.aria-label]="'Abrir registros de ' + resident.name"
                  >Abrir registros</a
                >
              </li>
            } @empty {
              <li class="health-state">
                <h3>Nenhum residente disponível</h3>
                <p class="muted">Confira o vínculo assistencial ou ajuste a busca.</p>
              </li>
            }
          </ul>
          @if (cursor() !== null) {
            <button
              type="button"
              class="btn-secondary health-pagination"
              [disabled]="loading()"
              (click)="load(true)"
            >
              Carregar mais residentes
            </button>
          }
        </section>
      }
    </main>
  `,
})
export class HealthResidentsPage extends LocalHealthState {
  readonly query = new FormControl('', { nonNullable: true });
  readonly residents = signal<HealthResident[]>([]);
  readonly total = signal(0);
  readonly cursor = signal<string | number | null>(null);
  constructor() {
    super();
    void this.load();
  }
  async load(more = false): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    if (!more) {
      this.residents.set([]);
      this.cursor.set(null);
    }
    try {
      const me = await this.capabilities();
      if (!me.professionalGrant) throw new ApiError(403);
      const page = await this.api.residents(
        this.query.value.trim(),
        more ? this.cursor() : undefined,
      );
      if (this.destroy.destroyed) return;
      this.me.set(me);
      this.residents.update((items) => (more ? [...items, ...page.items] : page.items));
      this.total.set(page.totalCount);
      this.cursor.set(page.nextCursor);
    } catch (error) {
      if (!this.destroy.destroyed) {
        this.residents.set([]);
        this.me.set(null);
        this.total.set(0);
        this.cursor.set(null);
        this.error.set(healthErrorMessage(error));
      }
    } finally {
      if (!this.destroy.destroyed) this.loading.set(false);
    }
  }
}

@Component({
  selector: 'app-health-resident',
  imports: [
    SearchableSelectDirective,
    UnsavedFormDirective,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    HealthNoteListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './health.scss',
  template: `
    <main class="page health-page">
      <a class="health-back" routerLink="/saude"
        ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Residentes
        assistidos</a
      >
      <header class="page-header health-heading">
        <div>
          <h1>{{ resident()?.name ?? 'Registros de saúde' }}</h1>
          @if (resident(); as patient) {
            <p>Matrícula {{ patient.enrollment }}</p>
          }
        </div>
        @if (resident() && !error()) {
          <button
            type="button"
            class="btn-secondary"
            [disabled]="busy() || loading()"
            (click)="export()"
          >
            <span class="material-symbols-rounded" aria-hidden="true">download</span>Baixar
            registros acessíveis (JSON)
          </button>
        }
      </header>
      @if (loading()) {
        <p role="status">Carregando registros assistenciais…</p>
      }
      @if (error()) {
        <p class="health-alert" role="alert">{{ error() }}</p>
        <button type="button" class="btn-secondary" [disabled]="loading()" (click)="load()">
          Carregar versão atual
        </button>
      }
      @if (success()) {
        <p class="health-success" role="status">{{ success() }}</p>
      }
      @if (resident(); as patient) {
        <section class="panel" aria-labelledby="patient-summary-title">
          <h2 id="patient-summary-title">Identificação</h2>
          <dl class="health-details">
            <div>
              <dt>Data de nascimento</dt>
              <dd>
                {{
                  patient.birthDate
                    ? (patient.birthDate | date: 'dd/MM/yyyy' : 'UTC')
                    : 'Não informada'
                }}
              </dd>
            </div>
            <div>
              <dt>Último registro assistencial</dt>
              <dd>
                {{
                  patient.lastRecordedAt
                    ? (patient.lastRecordedAt | date: 'dd/MM/yyyy HH:mm')
                    : 'Nenhum registro'
                }}
              </dd>
            </div>
          </dl>
          <details class="health-disclosure">
            <summary>Revisão de custódia</summary>
            <p>
              {{
                patient.reviewAfter
                  ? 'Revisão prevista em ' + (patient.reviewAfter | date: 'dd/MM/yyyy' : 'UTC')
                  : 'A data será definida após o primeiro registro assistencial.'
              }}. A revisão não exclui registros automaticamente.
            </p>
          </details>
        </section>
        <section class="panel health-section" aria-labelledby="resident-notes-title">
          <h2 id="resident-notes-title">Registros disponíveis</h2>
          <div class="field">
            <label for="resident-note-category">Filtrar categoria</label
            ><select
              sagerSearchable
              id="resident-note-category"
              [formControl]="filter"
              (change)="load()"
            >
              <option value="">Todas as categorias acessíveis</option>
              @for (category of allCategories; track category) {
                <option [value]="category">{{ categories[category] }}</option>
              }
            </select>
          </div>
          <p class="health-meta health-section" role="status">
            {{ total() }} {{ total() === 1 ? 'registro disponível' : 'registros disponíveis' }}
          </p>
          <app-health-note-list [notes]="notes()" />
          @if (cursor() !== null) {
            <button
              type="button"
              class="btn-secondary health-pagination"
              [disabled]="loading()"
              (click)="more()"
            >
              Carregar registros anteriores
            </button>
          }
        </section>
        @if (creationCategories().length > 0) {
          <section class="panel health-section" aria-labelledby="new-note-title">
            <h2 id="new-note-title">Registrar atendimento</h2>
            <p>
              O registro começa privado à sua conta. A partilha é feita depois, com destinatários
              selecionados.
            </p>
            @if (relatedNoteId) {
              <p class="health-meta">Continuidade do registro selecionado, com autoria própria.</p>
            }
            <form
              sagerUnsaved
              [sagerSaving]="busy"
              class="health-form"
              [formGroup]="form"
              (ngSubmit)="create()"
            >
              <div class="field">
                <label for="new-note-category">Categoria *</label
                ><select
                  sagerSearchable
                  id="new-note-category"
                  formControlName="category"
                  aria-describedby="new-note-category-help"
                  [attr.aria-invalid]="invalid('category')"
                >
                  <option value="">Selecione uma categoria</option>
                  @for (category of creationCategories(); track category) {
                    <option [value]="category">{{ categories[category] }}</option>
                  }</select
                ><span
                  id="new-note-category-help"
                  class="field-hint"
                  [class.field-error]="invalid('category')"
                  >Selecione uma categoria compatível com sua profissão.</span
                >
              </div>
              <div class="field health-section">
                <label for="new-note-body">Texto do registro *</label
                ><textarea
                  id="new-note-body"
                  formControlName="body"
                  rows="8"
                  maxlength="4000"
                  aria-describedby="new-note-body-help"
                  [attr.aria-invalid]="invalid('body')"
                ></textarea
                ><span
                  id="new-note-body-help"
                  class="field-hint"
                  [class.field-error]="invalid('body')"
                  >Use texto simples, de 1 a 4000 caracteres. Não inclua dados de terceiros, testes
                  ou protocolos psicológicos.</span
                >
              </div>
              <div class="action-row">
                <button class="btn" type="submit" [disabled]="busy() || loading()">
                  <span class="material-symbols-rounded" aria-hidden="true">save</span
                  >{{ busy() ? 'Salvando…' : 'Salvar registro' }}
                </button>
              </div>
            </form>
          </section>
        }
      }
    </main>
  `,
})
export class HealthResidentPage extends LocalHealthState {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly params = toSignal(this.route.paramMap);
  readonly id = computed(() => this.params()?.get('id') ?? '');
  readonly relatedNoteId = this.route.snapshot.queryParamMap.get('continuidade') ?? undefined;
  readonly resident = signal<HealthResident | null>(null);
  readonly notes = signal<HealthNoteSummary[]>([]);
  readonly cursor = signal<string | number | null>(null);
  readonly total = signal(0);
  readonly busy = signal(false);
  readonly filter = new FormControl('', { nonNullable: true });
  readonly creationCategories = computed(() => {
    const grant = this.me()?.professionalGrant;
    return grant ? categoriesFor(grant.profession) : [];
  });
  readonly form = new FormGroup({
    category: new FormControl<HealthCategory | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    body: new FormControl('', {
      nonNullable: true,
      validators: [trimmedLength(1, 4000), plainHealthText],
    }),
  });
  private request = 0;
  constructor() {
    super();
    effect(() => {
      this.id();
      void this.load();
    });
  }
  invalid(name: 'body' | 'category'): boolean {
    return this.form.controls[name].touched && this.form.controls[name].invalid;
  }
  async load(): Promise<void> {
    const request = ++this.request;
    const id = this.id();
    this.loading.set(true);
    this.error.set('');
    this.resident.set(null);
    this.notes.set([]);
    this.me.set(null);
    this.cursor.set(null);
    try {
      const me = await this.capabilities();
      if (!me.professionalGrant) throw new ApiError(403);
      const [patient, page] = await Promise.all([
        this.api.resident(id),
        this.api.notes(id, this.filter.value),
      ]);
      if (this.destroy.destroyed || request !== this.request) return;
      this.me.set(me);
      this.resident.set(patient);
      this.notes.set(page.items);
      this.total.set(page.totalCount);
      this.cursor.set(page.nextCursor);
    } catch (error) {
      if (!this.destroy.destroyed && request === this.request) {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) this.form.reset();
        this.error.set(healthErrorMessage(error));
      }
    } finally {
      if (!this.destroy.destroyed && request === this.request) this.loading.set(false);
    }
  }
  async more(): Promise<void> {
    if (this.loading() || this.cursor() === null) return;
    const request = this.request;
    this.loading.set(true);
    try {
      const page = await this.api.notes(this.id(), this.filter.value, this.cursor());
      if (this.destroy.destroyed || request !== this.request) return;
      this.notes.update((items) => [...items, ...page.items]);
      this.cursor.set(page.nextCursor);
    } catch (error) {
      if (request === this.request) this.failure(error);
    } finally {
      if (!this.destroy.destroyed && request === this.request) this.loading.set(false);
    }
  }
  async create(): Promise<void> {
    if (this.busy() || this.loading() || !this.resident()) return;
    const id = this.id();
    const value = this.form.getRawValue();
    if (
      this.form.invalid ||
      !value.category ||
      !this.creationCategories().includes(value.category)
    ) {
      this.form.markAllAsTouched();
      setTimeout(
        () =>
          this.element.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
        0,
      );
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const note = await this.api.createNote(id, {
        category: value.category,
        body: value.body.trim(),
        ...(this.relatedNoteId ? { relatedNoteId: this.relatedNoteId } : {}),
      });
      if (!this.destroy.destroyed && id === this.id()) {
        this.busy.set(false);
        this.form.reset();
        this.form.markAsPristine();
        await this.router.navigate(['/saude/notas', note.id], { queryParams: { salvo: '1' } });
      }
    } catch (error) {
      this.failure(error);
    } finally {
      if (!this.destroy.destroyed) this.busy.set(false);
    }
  }
  async export(): Promise<void> {
    if (this.busy() || !this.resident()) return;
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    try {
      const value = await this.api.export(this.id());
      if (!this.destroy.destroyed) {
        downloadHealthExport(value);
        this.success.set(
          'Cópia JSON baixada com os registros atualmente acessíveis. Guarde o arquivo em local protegido.',
        );
      }
    } catch (error) {
      this.failure(error);
    } finally {
      if (!this.destroy.destroyed) this.busy.set(false);
    }
  }
  private failure(error: unknown): void {
    if (this.destroy.destroyed) return;
    this.error.set(healthErrorMessage(error));
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      ++this.request;
      this.loading.set(false);
      this.resident.set(null);
      this.notes.set([]);
      this.me.set(null);
      this.form.reset();
      this.cursor.set(null);
    }
  }
}

@Component({
  selector: 'app-health-note',
  imports: [RouterLink, HealthNoteDetailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './health.scss',
  template: `
    <main class="page health-page">
      <a class="health-back" routerLink="/saude"
        ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Residentes
        assistidos</a
      >
      <header class="page-header">
        <div>
          <h1>Registro de saúde</h1>
          <p>Consulte o conteúdo, as versões e a partilha autorizada.</p>
        </div>
      </header>
      @if (saved) {
        <p class="health-success" role="status">
          Registro salvo. O conteúdo permanece privado até uma partilha explícita.
        </p>
      }
      <app-health-note-detail [noteId]="id()" />
    </main>
  `,
})
export class HealthNotePage {
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap);
  readonly id = computed(() => this.params()?.get('id') ?? '');
  readonly saved = this.route.snapshot.queryParamMap.get('salvo') === '1';
}

@Component({
  selector: 'app-own-health',
  imports: [
    SearchableSelectDirective,
    ReactiveFormsModule,
    HealthNoteListComponent,
    HealthNoteDetailComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './health.scss',
  template: `
    <main class="page health-page">
      <header class="page-header health-heading">
        <div>
          <h1>Minha saúde</h1>
          <p>Consulte seus registros e o histórico preservado dos atendimentos.</p>
        </div>
        @if (me()?.canAccessOwnRecord && !error()) {
          <button
            type="button"
            class="btn-secondary"
            [disabled]="busy() || loading()"
            (click)="export()"
          >
            <span class="material-symbols-rounded" aria-hidden="true">download</span>Baixar meus
            registros (JSON)
          </button>
        }
      </header>
      @if (loading()) {
        <p role="status">Carregando seus registros…</p>
      }
      @if (error()) {
        <p class="health-alert" role="alert">{{ error() }}</p>
        <button type="button" class="btn-secondary" [disabled]="loading()" (click)="load()">
          Tentar novamente
        </button>
      }
      @if (success()) {
        <p class="health-success" role="status">{{ success() }}</p>
      }
      @if (me()?.canAccessOwnRecord) {
        @if (selected(); as noteId) {
          <button type="button" class="btn-secondary health-actions" (click)="close()">
            Voltar aos meus registros
          </button>
          <div class="health-section">
            <app-health-note-detail [noteId]="noteId" [own]="true" />
          </div>
        } @else {
          <section class="panel health-section" aria-labelledby="own-records-title">
            <h2 id="own-records-title" tabindex="-1">Meus registros</h2>
            <div class="field">
              <label for="own-note-category">Filtrar categoria</label
              ><select
                sagerSearchable
                id="own-note-category"
                [formControl]="filter"
                (change)="load()"
              >
                <option value="">Todas as categorias</option>
                @for (category of allCategories; track category) {
                  <option [value]="category">{{ categories[category] }}</option>
                }
              </select>
            </div>
            <p class="health-meta health-section" role="status">
              {{ total() }} {{ total() === 1 ? 'registro disponível' : 'registros disponíveis' }}
            </p>
            <app-health-note-list
              [notes]="notes()"
              [own]="true"
              (selected)="selected.set($event)"
            />
            @if (cursor() !== null) {
              <button
                type="button"
                class="btn-secondary health-pagination"
                [disabled]="loading()"
                (click)="load(true)"
              >
                Carregar registros anteriores
              </button>
            }
          </section>
        }
      }
    </main>
  `,
})
export class OwnHealthPage extends LocalHealthState {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly notes = signal<HealthNoteSummary[]>([]);
  readonly total = signal(0);
  readonly cursor = signal<string | number | null>(null);
  readonly selected = signal<string | null>(null);
  readonly busy = signal(false);
  readonly filter = new FormControl('', { nonNullable: true });
  private request = 0;
  constructor() {
    super();
    void this.load();
  }
  close(): void {
    this.selected.set(null);
    setTimeout(
      () => this.element.nativeElement.querySelector<HTMLElement>('#own-records-title')?.focus(),
      0,
    );
  }
  async load(more = false): Promise<void> {
    if (more && this.loading()) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    this.selected.set(null);
    if (!more) {
      this.notes.set([]);
      this.cursor.set(null);
    }
    try {
      const me = await this.capabilities();
      if (!me.canAccessOwnRecord) throw new ApiError(403);
      const page = await this.api.ownNotes(this.filter.value, more ? this.cursor() : undefined);
      if (this.destroy.destroyed || request !== this.request) return;
      this.me.set(me);
      this.notes.update((items) => (more ? [...items, ...page.items] : page.items));
      this.total.set(page.totalCount);
      this.cursor.set(page.nextCursor);
    } catch (error) {
      if (!this.destroy.destroyed && request === this.request) {
        this.me.set(null);
        this.notes.set([]);
        this.cursor.set(null);
        this.error.set(healthErrorMessage(error));
      }
    } finally {
      if (!this.destroy.destroyed && request === this.request) this.loading.set(false);
    }
  }
  async export(): Promise<void> {
    if (this.busy() || !this.me()?.canAccessOwnRecord) return;
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    try {
      const value = await this.api.export();
      if (!this.destroy.destroyed) {
        downloadHealthExport(value);
        this.success.set('Cópia dos seus registros baixada. Guarde o arquivo em local protegido.');
      }
    } catch (error) {
      if (!this.destroy.destroyed) {
        this.error.set(healthErrorMessage(error));
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
          this.me.set(null);
          this.notes.set([]);
          this.selected.set(null);
        }
      }
    } finally {
      if (!this.destroy.destroyed) this.busy.set(false);
    }
  }
}
