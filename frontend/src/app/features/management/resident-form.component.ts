import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UnsavedFormDirective } from '../../shared/unsaved-form';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Course, CourseApiService } from './course-api.service';
import { normalizeSearch } from '../../shared/search';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';
import {
  ResidentApiError,
  ResidentApiService,
  ResidentPayload,
  ResidentRecord,
} from './resident-api.service';

function localToday(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function validBirthDate(control: AbstractControl): { invalidDate: true } | null {
  const value = String(control.value ?? '');
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > localToday()) return { invalidDate: true };
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? null
    : { invalidDate: true };
}

@Component({
  selector: 'app-resident-form',
  standalone: true,
  imports: [UnsavedFormDirective, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page mg-narrow">
      @if (!canEdit()) {
        <section class="mg-empty" role="alert">
          <span class="material-symbols-rounded" aria-hidden="true">lock</span>
          <h1>Acesso restrito</h1>
          <p>O cadastro de residentes está disponível para gestor e supervisor.</p>
          <a class="btn mg-primary" routerLink="/residentes">Voltar aos residentes</a>
        </section>
      } @else if (loading()) {
        <section class="mg-empty" role="status" aria-live="polite">
          <span class="material-symbols-rounded mg-loading-icon" aria-hidden="true"
            >progress_activity</span
          >
          <h1>Carregando residente</h1>
          <p>Consultando o cadastro local de teste.</p>
        </section>
      } @else if (loadError()) {
        <section class="mg-empty" role="alert">
          <h1>
            {{ missing() ? 'Residente não encontrado' : 'Não foi possível carregar o residente' }}
          </h1>
          <p>{{ loadError() }}</p>
          @if (!missing()) {
            <button type="button" class="btn mg-primary" (click)="load()">Tentar novamente</button>
          }
          <a class="btn mg-secondary" routerLink="/residentes">Voltar aos residentes</a>
        </section>
      } @else if (editId && !resident()) {
        <section class="mg-empty" role="alert">
          <h1>Residente não encontrado</h1>
          <p>
            O cadastro solicitado não está disponível
            {{ isDemo() ? 'nesta demonstração' : 'no ambiente local de teste' }}.
          </p>
          <a class="btn mg-primary" routerLink="/residentes">Voltar aos residentes</a>
        </section>
      } @else {
        <header class="mg-heading">
          <div>
            <a class="mg-back" routerLink="/residentes"
              ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
              Residentes</a
            >
            <h1>{{ editId ? 'Editar residente' : 'Cadastrar residente' }}</h1>
            <p>Preencha os dados de identificação e vínculo acadêmico.</p>
          </div>
        </header>
        <form
          sagerUnsaved
          [sagerSaving]="pendingSave"
          class="panel mg-panel mg-form"
          [formGroup]="form"
          (ngSubmit)="save()"
          novalidate
        >
          <h2>Dados do residente</h2>
          <p class="mg-muted">
            Campos marcados com * são obrigatórios. Use somente dados fictícios
            {{ isDemo() ? 'nesta demonstração' : 'no ambiente local de teste' }}.
          </p>
          <div class="form-grid mg-form-grid">
            <label class="field mg-field mg-span-2"
              >Nome completo *
              <input
                [attr.aria-invalid]="
                  form.controls.name.invalid && form.controls.name.touched ? 'true' : null
                "
                formControlName="name"
                autocomplete="name"
                maxlength="200"
                aria-describedby="resident-name-error"
              />
              @if (form.controls.name.invalid && form.controls.name.touched) {
                <span class="mg-field-error" id="resident-name-error"
                  >Informe o nome completo com 3 a 200 caracteres.</span
                >
              }
            </label>
            <label class="field mg-field"
              >Matrícula *
              <input
                [attr.aria-invalid]="
                  form.controls.enrollment.invalid && form.controls.enrollment.touched
                    ? 'true'
                    : null
                "
                formControlName="enrollment"
                autocomplete="off"
                maxlength="64"
                aria-describedby="resident-enrollment-error"
              />
              @if (form.controls.enrollment.invalid && form.controls.enrollment.touched) {
                <span class="mg-field-error" id="resident-enrollment-error"
                  >Informe a matrícula vinculada ao residente, com até 64 caracteres.</span
                >
              }
            </label>
            <label class="field mg-field"
              >Data de nascimento *
              <input
                type="date"
                formControlName="birthDate"
                [max]="today"
                required
                [attr.aria-invalid]="
                  form.controls.birthDate.invalid && form.controls.birthDate.touched ? 'true' : null
                "
                aria-describedby="resident-birth-error"
              />
              @if (form.controls.birthDate.invalid && form.controls.birthDate.touched) {
                <span class="mg-field-error" id="resident-birth-error">{{
                  form.controls.birthDate.hasError('required')
                    ? 'Informe a data de nascimento.'
                    : 'Informe uma data de nascimento válida e não futura.'
                }}</span>
              }
            </label>
            <label class="mg-field"
              >E-mail institucional <small>Opcional</small>
              <input
                type="email"
                formControlName="institutionalEmail"
                autocomplete="email"
                maxlength="320"
                [attr.aria-invalid]="
                  form.controls.institutionalEmail.invalid &&
                  form.controls.institutionalEmail.touched
                    ? 'true'
                    : null
                "
                aria-describedby="resident-email-error"
              />
              @if (
                form.controls.institutionalEmail.invalid && form.controls.institutionalEmail.touched
              ) {
                <span class="mg-field-error" id="resident-email-error"
                  >Informe um e-mail válido.</span
                >
              }
            </label>
            <div class="mg-field">
              <label for="course-search">Buscar curso</label
              ><input
                id="course-search"
                type="search"
                data-filter-input
                [value]="courseQuery()"
                (input)="courseQuery.set($any($event.target).value)"
                placeholder="Nome do curso"
              />
              <label for="resident-course">Curso <small>Opcional</small></label>
              <select id="resident-course" formControlName="courseId">
                <option value="">Sem curso informado</option>
                @for (course of visibleCourses(); track course.id) {
                  <option
                    [value]="course.id"
                    [disabled]="!course.active && course.id !== form.controls.courseId.value"
                  >
                    {{ course.name }}{{ course.active ? '' : ' (inativo)' }}
                  </option>
                }
              </select>
              @if (coursesError()) {
                <p role="alert">{{ coursesError() }}</p>
                <button type="button" class="btn mg-secondary" (click)="loadCourses()">
                  Tentar novamente
                </button>
              }
              <button
                type="button"
                class="btn mg-secondary"
                (click)="addingCourse.set(!addingCourse())"
              >
                {{ addingCourse() ? 'Fechar novo curso' : 'Novo curso' }}
              </button>
              @if (addingCourse()) {
                <label for="new-course">Nome do novo curso</label
                ><input id="new-course" [formControl]="newCourse" maxlength="200" />
                <button
                  type="button"
                  class="btn"
                  [disabled]="saving() || courseSaving()"
                  (click)="createCourse()"
                >
                  {{ courseSaving() ? 'Cadastrando…' : 'Cadastrar e selecionar' }}
                </button>
              }
            </div>
            @if (!editId) {
              <label class="mg-field"
                >Senha escolhida pelo residente<input
                  type="password"
                  formControlName="password"
                  [attr.aria-invalid]="
                    form.controls.password.invalid && form.controls.password.touched
                  "
                  aria-describedby="resident-password-help"
                  autocomplete="new-password"
                  minlength="12"
                  maxlength="72"
                  required
                /><small id="resident-password-help"
                  >De 12 a 72 caracteres; no máximo 72 bytes.</small
                >
                @if (form.controls.password.invalid && form.controls.password.touched) {
                  <span class="mg-field-error"
                    >Informe uma senha com pelo menos 12 caracteres.</span
                  >
                }
              </label>
              <label class="mg-field"
                >Confirmar senha<input
                  type="password"
                  formControlName="passwordConfirmation"
                  autocomplete="new-password"
                  required
              /></label>
            }
          </div>
          <div class="mg-note">
            <span class="material-symbols-rounded" aria-hidden="true">info</span>
            <p>
              @if (isDemo()) {
                A alocação ou transferência entre quartos depende das regras da AE. Responsáveis
                legais podem ser vinculados depois de salvar o residente. Dados médicos não são
                exibidos neste protótipo.
              } @else {
                A origem e validação definitiva da matrícula e as regras para dados sensíveis ainda
                dependem de decisão institucional. Responsáveis e quartos podem ser vinculados após
                salvar o residente.
              }
            </p>
          </div>
          @if (error()) {
            <p class="mg-alert" role="alert">{{ error() }}</p>
          }
          @if (conflict()) {
            <button type="button" class="btn mg-secondary" (click)="reloadLatest()">
              Carregar versão atual do cadastro
            </button>
          }
          <div class="action-row mg-actions">
            <a
              class="btn mg-secondary"
              [routerLink]="editId ? ['/residentes', editId] : ['/residentes']"
              >Cancelar</a
            ><button class="btn mg-primary" type="submit" [disabled]="saving() || courseSaving()">
              <span class="material-symbols-rounded" aria-hidden="true">save</span>
              {{ saving() ? 'Salvando…' : 'Salvar residente' }}
            </button>
          </div>
        </form>
      }
    </main>
  `,
})
export class ResidentFormComponent {
  private readonly service = inject(ManagementDemoService);
  private readonly coursesApi = inject(CourseApiService);
  readonly courses = signal<Course[]>([]);
  readonly courseQuery = signal('');
  readonly coursesError = signal('');
  readonly addingCourse = signal(false);
  readonly courseSaving = signal(false);
  readonly newCourse = new FormControl('', { nonNullable: true });
  readonly visibleCourses = computed(() =>
    this.courses().filter(
      (c) =>
        c.id === this.form.controls.courseId.value ||
        (c.active && normalizeSearch(c.name).includes(normalizeSearch(this.courseQuery()))),
    ),
  );
  async loadCourses(): Promise<void> {
    this.coursesError.set('');
    try {
      const items = await this.coursesApi.list();
      if (!this.destroyRef.destroyed) this.courses.set(items);
    } catch {
      if (!this.destroyRef.destroyed)
        this.coursesError.set('Não foi possível carregar os cursos. Tente novamente.');
    }
  }
  async createCourse(): Promise<void> {
    if (this.saving() || this.courseSaving()) return;
    this.courseSaving.set(true);
    this.coursesError.set('');
    try {
      const course = await this.coursesApi.save(this.newCourse.value);
      if (this.destroyRef.destroyed) return;
      this.courses.update((items) => [...items, course]);
      this.form.controls.courseId.setValue(course.id);
      this.form.markAsDirty();
      this.newCourse.reset();
      this.addingCourse.set(false);
    } catch (error) {
      if (!this.destroyRef.destroyed)
        this.coursesError.set(
          error instanceof Error ? error.message : 'Não foi possível cadastrar o curso.',
        );
    } finally {
      if (!this.destroyRef.destroyed) this.courseSaving.set(false);
    }
  }
  private readonly api = inject(ResidentApiService);
  private readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly editId = this.route.snapshot.paramMap.get('id');
  readonly isDemo = this.session.active;
  readonly canEdit = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly localResident = signal<ResidentRecord | null>(null);
  readonly resident = computed(() =>
    this.editId
      ? this.isDemo()
        ? this.service.resident(this.editId)
        : (this.localResident() ?? undefined)
      : undefined,
  );
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly missing = signal(false);
  readonly error = signal('');
  readonly conflict = signal(false);
  readonly saving = signal(false);
  readonly pendingSave = computed(() => this.saving() || this.courseSaving());
  readonly today = localToday();
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
    }),
    enrollment: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(64)],
    }),
    birthDate: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, validBirthDate],
    }),
    courseId: new FormControl('', { nonNullable: true }),
    institutionalEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(320)],
    }),
    password: new FormControl('', { nonNullable: true }),
    passwordConfirmation: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.newCourse.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value) this.form.markAsDirty();
    });
    void this.loadCourses();
    if (!this.editId) {
      this.form.controls.password.setValidators([
        Validators.required,
        Validators.minLength(12),
        Validators.maxLength(72),
      ]);
      this.form.controls.passwordConfirmation.setValidators(Validators.required);
    }
    if (this.isDemo()) {
      const existing = this.resident();
      if (existing) this.setFields(existing);
    } else {
      if (this.editId && this.canEdit()) void this.load();
    }
  }

  async load(): Promise<void> {
    if (!this.editId || this.isDemo()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.missing.set(false);
    try {
      const item = await this.api.get(this.editId);
      if (this.destroyRef.destroyed) return;
      this.localResident.set(item);
      this.setFields(item);
    } catch (error) {
      if (this.destroyRef.destroyed) return;
      this.localResident.set(null);
      this.missing.set(error instanceof ResidentApiError && error.status === 404);
      this.loadError.set(
        this.missing()
          ? 'O cadastro solicitado não está disponível no ambiente local de teste.'
          : 'Confira a conexão com o backend local e tente novamente.',
      );
    } finally {
      if (!this.destroyRef.destroyed) this.loading.set(false);
    }
  }

  async reloadLatest(): Promise<void> {
    this.conflict.set(false);
    this.error.set('');
    await this.load();
  }

  async save(): Promise<void> {
    if (!this.canEdit() || this.saving() || this.courseSaving()) return;
    this.error.set('');
    this.conflict.set(false);
    const fields = this.form.getRawValue();
    this.form.patchValue(
      {
        name: fields.name.trim(),
        enrollment: fields.enrollment.trim(),
        institutionalEmail: fields.institutionalEmail.trim(),
      },
      { emitEvent: false },
    );
    if (this.form.invalid || this.form.controls.birthDate.value > this.today) {
      this.form.markAllAsTouched();
      if (this.form.controls.birthDate.value > this.today)
        this.form.controls.birthDate.setErrors({ future: true });
      return;
    }
    if (
      !this.editId &&
      (fields.password !== fields.passwordConfirmation ||
        new TextEncoder().encode(fields.password).length > 72)
    ) {
      this.error.set('Repita a mesma senha, com 12 a 72 caracteres e até 72 bytes.');
      return;
    }
    if (this.isDemo()) {
      try {
        const saved = this.service.saveResident(
          {
            ...this.form.getRawValue(),
            course: this.courses().find((c) => c.id === fields.courseId)?.name ?? '',
          },
          this.editId ?? undefined,
        );
        this.form.markAsPristine();
        void this.router.navigate(['/residentes', saved.id], { queryParams: { saved: '1' } });
      } catch (error) {
        this.error.set(
          error instanceof Error
            ? error.message
            : 'Não foi possível salvar o residente. Tente novamente.',
        );
      }
      return;
    }
    const current = this.localResident();
    if (this.editId && !current) return;
    const {
      name,
      enrollment,
      birthDate,
      courseId,
      institutionalEmail,
      password,
      passwordConfirmation,
    } = this.form.getRawValue();
    const input: ResidentPayload = {
      name,
      enrollment,
      birthDate,
      courseId: courseId || null,
      institutionalEmail: institutionalEmail || null,
      ...(!this.editId ? { password, passwordConfirmation } : {}),
    };
    this.saving.set(true);
    try {
      const saved = await this.api.save(
        input,
        this.editId && current ? { id: current.id, version: current.version } : undefined,
      );
      if (this.destroyRef.destroyed) return;
      this.saving.set(false);
      this.form.markAsPristine();
      await this.router.navigate(['/residentes', saved.id], { queryParams: { saved: '1' } });
    } catch (error) {
      if (this.destroyRef.destroyed) return;
      if (error instanceof ResidentApiError && error.status === 409) {
        const stale = !!this.editId && error.code === 'stale_version';
        this.conflict.set(stale);
        this.error.set(
          stale
            ? 'Este cadastro foi alterado por outra sessão. Carregue a versão atual antes de salvar novamente.'
            : 'Já existe um cadastro com esta matrícula. Confira os dados.',
        );
      } else if (error instanceof ResidentApiError && error.status === 400) {
        this.error.set('Os dados foram recusados. Confira os campos e tente novamente.');
      } else if (error instanceof ResidentApiError && error.status === 404) {
        this.error.set('O cadastro não existe mais. Volte à lista de residentes.');
      } else if (error instanceof ResidentApiError && error.status === 401) {
        this.error.set('A sessão expirou. Entre novamente para salvar.');
      } else if (error instanceof ResidentApiError && error.status === 403) {
        this.error.set('Seu perfil não tem permissão para salvar este cadastro.');
      } else {
        this.error.set(
          'Não foi possível salvar. Confira a conexão com o backend local e tente novamente.',
        );
      }
    } finally {
      if (!this.destroyRef.destroyed) this.saving.set(false);
    }
  }

  private setFields(item: {
    name: string;
    enrollment: string;
    birthDate: string | null;
    course: string | null;
    courseId?: string | null;
    institutionalEmail?: string | null;
  }): void {
    this.form.reset({
      name: item.name,
      enrollment: item.enrollment,
      birthDate: item.birthDate ?? '',
      courseId:
        item.courseId ??
        this.coursesApi.demoCourses().find((c) => c.name === item.course)?.id ??
        '',
      institutionalEmail: item.institutionalEmail ?? '',
      password: '',
      passwordConfirmation: '',
    });
  }
}
