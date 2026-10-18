import { rememberValue } from '../../core/filter-state';
import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Course, CourseApiService } from './course-api.service';
import { normalizeSearch } from '../../shared/search';
import { UnsavedFormDirective, UnsavedForms } from '../../shared/unsaved-form';
@Component({
  standalone: true,
  imports: [SearchableSelectDirective, ReactiveFormsModule, UnsavedFormDirective],
  template: ` <main class="page mg-page">
    <header class="mg-heading">
      <div>
        <h1>Cursos</h1>
        <p>Cadastre os cursos que poderão ser selecionados nos residentes.</p>
      </div>
    </header>
    <form
      class="panel mg-panel mg-form"
      [formGroup]="form"
      sagerUnsaved
      [sagerSaving]="saving"
      (ngSubmit)="save()"
    >
      <h2>{{ editing() ? 'Editar curso' : 'Novo curso' }}</h2>
      <label class="mg-field"
        >Nome do curso<input formControlName="name" maxlength="200" required
      /></label>
      @if (form.controls.name.invalid && form.controls.name.touched) {
        <p class="mg-field-error">Informe um nome de até 200 caracteres.</p>
      }
      <div class="action-row">
        @if (editing()) {
          <button type="button" class="btn mg-secondary" (click)="cancel()">Cancelar edição</button>
        }
        <button class="btn mg-primary" [disabled]="saving()">
          {{ saving() ? 'Salvando…' : 'Salvar curso' }}
        </button>
      </div>
    </form>
    @if (error()) {
      <p class="mg-alert" role="alert">{{ error() }}</p>
    }
    @if (notice()) {
      <p class="mg-success" role="status">
        <span class="material-symbols-rounded" aria-hidden="true">check_circle</span>{{ notice() }}
      </p>
    }
    <section class="panel mg-panel">
      <div class="mg-filters">
        <label class="mg-field mg-grow"
          >Buscar curso<input
            type="search"
            [value]="query()"
            (input)="query.set($any($event.target).value); page.set(0)"
        /></label>
        <label class="mg-field"
          >Situação<select
            sagerSearchable
            [value]="status()"
            (change)="status.set($any($event.target).value); page.set(0)"
          >
            <option value="">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select></label
        >
        <button class="btn mg-secondary" (click)="query.set(''); status.set(''); page.set(0)">
          Limpar filtros
        </button>
      </div>
      @if (loading()) {
        <p role="status">Carregando cursos…</p>
      } @else {
        <p role="status">{{ filtered().length }} curso(s) encontrado(s)</p>
        @for (course of visible(); track course.id) {
          <div class="course-row">
            <div>
              <strong>{{ course.name }}</strong>
              <p>
                <span class="mg-status" [attr.data-tone]="course.active ? null : 'neutral'"
                  ><span class="material-symbols-rounded" aria-hidden="true">{{
                    course.active ? 'check_circle' : 'block'
                  }}</span
                  >{{ course.active ? 'Ativo' : 'Inativo' }}</span
                >{{ course.active ? '' : ' · mantido nos cadastros existentes' }}
              </p>
            </div>
            <div class="action-row">
              <button class="btn mg-secondary" (click)="edit(course)">Editar</button
              ><button class="btn mg-secondary" [disabled]="saving()" (click)="toggle(course)">
                {{ course.active ? 'Desativar' : 'Reativar' }}
              </button>
            </div>
          </div>
        } @empty {
          <p>Nenhum curso corresponde aos filtros.</p>
        }
        <nav class="action-row" aria-label="Páginas de cursos">
          <button
            class="btn mg-secondary"
            [disabled]="page() === 0"
            (click)="page.update(previous)"
          >
            Anterior</button
          ><span>Página {{ page() + 1 }}</span
          ><button
            class="btn mg-secondary"
            [disabled]="(page() + 1) * 25 >= filtered().length"
            (click)="page.update(next)"
          >
            Próxima
          </button>
        </nav>
      }
    </section>
  </main>`,
  styles: [
    `
      .course-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px 24px;
        padding: 20px 0;
        border-top: 1px solid var(--line);
      }
      .course-row:last-of-type {
        border-bottom: 1px solid var(--line);
      }
      .course-row p {
        margin: 8px 0 0;
        color: var(--muted);
      }
      form {
        margin-bottom: 24px;
      }
      form .action-row,
      nav.action-row {
        margin-top: 16px;
      }
      .mg-filters + p {
        margin: 16px 0 8px;
      }
    `,
  ],
})
export class CoursesPage {
  private readonly api = inject(CourseApiService);
  private readonly destroy = inject(DestroyRef);
  private readonly guard = inject(UnsavedForms);
  readonly items = signal<Course[]>([]);
  readonly query = rememberValue('courses-query', '');
  readonly status = rememberValue('courses-status', '');
  readonly page = rememberValue('courses-page', 0);
  readonly editing = signal<Course | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
  });
  readonly filtered = computed(() =>
    this.items()
      .filter(
        (c) =>
          normalizeSearch(c.name).includes(normalizeSearch(this.query())) &&
          (!this.status() || c.active === (this.status() === 'active')),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id)),
  );
  readonly visible = computed(() =>
    this.filtered().slice(this.page() * 25, (this.page() + 1) * 25),
  );
  readonly previous = (n: number) => Math.max(0, n - 1);
  readonly next = (n: number) => n + 1;
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const items = await this.api.list();
      if (!this.destroy.destroyed) {
        this.items.set(items);
        const lastPage = Math.max(0, Math.ceil(this.filtered().length / 25) - 1);
        this.page.update((page) => Math.max(0, Math.min(page, lastPage)));
      }
    } catch (e) {
      if (!this.destroy.destroyed)
        this.error.set(e instanceof Error ? e.message : 'Falha ao carregar cursos.');
    } finally {
      if (!this.destroy.destroyed) this.loading.set(false);
    }
  }
  async edit(course: Course): Promise<void> {
    if (!(await this.guard.canLeave())) return;
    this.editing.set(course);
    this.form.reset({ name: course.name });
  }
  async cancel(): Promise<void> {
    if (!(await this.guard.canLeave())) return;
    this.editing.set(null);
    this.form.reset();
  }
  async save(): Promise<void> {
    if (this.saving()) return;
    this.notice.set('');
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      await this.api.save(
        this.form.controls.name.value,
        this.editing() ?? undefined,
        this.editing()?.active ?? true,
      );
      if (this.destroy.destroyed) return;
      this.form.reset();
      this.editing.set(null);
      this.notice.set('Curso salvo.');
      await this.load();
    } catch (e) {
      if (!this.destroy.destroyed)
        this.error.set(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      if (!this.destroy.destroyed) this.saving.set(false);
    }
  }
  async toggle(course: Course): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const saved = await this.api.save(course.name, course, !course.active);
      if (this.destroy.destroyed) return;
      this.editing.update((current) => (current?.id === saved.id ? saved : current));
      await this.load();
    } catch (e) {
      if (!this.destroy.destroyed)
        this.error.set(e instanceof Error ? e.message : 'Falha ao alterar curso.');
    } finally {
      if (!this.destroy.destroyed) this.saving.set(false);
    }
  }
}
