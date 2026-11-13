import {
  ERROR_CONFLICT,
  ERROR_FORBIDDEN,
  ERROR_GENERIC,
  ERROR_SESSION,
  readableError,
} from '../../core/error-messages';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UnsavedFormDirective } from '../../shared/unsaved-form';
import { PasswordFieldComponent } from '../../shared/password-field.component';
import { PASSWORD_HELP, PASSWORD_MISMATCH, passwordRules } from '../../shared/password-rules';
import {
  birthDateProblem,
  civilToday,
  entryYearProblem,
  extraSemestersProblem,
  fieldRule,
  nameProblem,
  normalizeEnrollment,
  residentEmailProblem,
  residentEnrollmentProblem,
  trimmedLength,
} from '../../shared/field-rules';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Course, CourseApiService, CourseLevel } from './course-api.service';
import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';
import {
  ResidentApiError,
  ResidentApiService,
  ResidentPayload,
  ResidentRecord,
} from './resident-api.service';

@Component({
  selector: 'app-resident-form',
  standalone: true,
  imports: [
    SearchableSelectDirective,
    UnsavedFormDirective,
    ReactiveFormsModule,
    RouterLink,
    PasswordFieldComponent,
  ],
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
          <p>Aguarde um momento.</p>
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
          <p>Não encontramos este cadastro. Volte à lista e tente de novo.</p>
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
            <p>Preencha os dados do residente.</p>
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
            Campos marcados com * são obrigatórios.
            @if (isDemo()) {
              Use somente dados fictícios nesta demonstração.
            }
          </p>
          <div class="form-grid mg-form-grid">
            <label class="field mg-field mg-span-2"
              >Nome completo *
              <input
                [attr.aria-invalid]="
                  form.controls.name.invalid && form.controls.name.touched ? 'true' : null
                "
                formControlName="name"
                autocomplete="off"
                maxlength="200"
                aria-describedby="resident-name-error"
              />
              @if (form.controls.name.invalid && form.controls.name.touched) {
                <span class="mg-field-error" id="resident-name-error">{{
                  form.controls.name.errors?.['fieldRule']
                }}</span>
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
                <span class="mg-field-error" id="resident-enrollment-error">{{
                  form.controls.enrollment.errors?.['fieldRule']
                }}</span>
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
                  form.controls.birthDate.errors?.['fieldRule']
                }}</span>
              }
            </label>
            <label class="mg-field"
              >E-mail institucional <small>Opcional</small>
              <input
                type="email"
                formControlName="institutionalEmail"
                autocomplete="off"
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
                <span class="mg-field-error" id="resident-email-error">{{
                  form.controls.institutionalEmail.errors?.['fieldRule']
                }}</span>
              }
            </label>
            <div class="mg-field">
              <label for="resident-course">Curso *</label>
              <select
                sagerSearchable
                id="resident-course"
                formControlName="courseId"
                [attr.aria-invalid]="
                  form.controls.courseId.invalid && form.controls.courseId.touched ? 'true' : null
                "
                aria-describedby="resident-course-error"
              >
                <option value="">Selecione o curso</option>
                @for (course of visibleCourses(); track course.id) {
                  <option
                    [value]="course.id"
                    [disabled]="!course.active && course.id !== form.controls.courseId.value"
                  >
                    {{ course.name }}{{ course.active ? '' : ' (inativo)' }}
                  </option>
                }
              </select>
              @if (form.controls.courseId.invalid && form.controls.courseId.touched) {
                <span class="mg-field-error" id="resident-course-error">Escolha o curso.</span>
              }
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
                ><input
                  id="new-course"
                  [formControl]="newCourse"
                  maxlength="200"
                  [attr.aria-invalid]="newCourse.invalid && newCourse.touched ? 'true' : null"
                  aria-describedby="new-course-error"
                />
                @if (newCourse.invalid && newCourse.touched) {
                  <span class="mg-field-error" id="new-course-error"
                    >Informe um nome de até 200 caracteres.</span
                  >
                }
                <label for="new-course-level">Nível do novo curso</label
                ><select
                  id="new-course-level"
                  [formControl]="newCourseLevel"
                  [attr.aria-invalid]="
                    newCourseLevel.invalid && newCourseLevel.touched ? 'true' : null
                  "
                  aria-describedby="new-course-level-error"
                >
                  <option value="">Selecione o nível</option>
                  <option value="MEDIO">Ensino médio</option>
                  <option value="SUPERIOR">Superior</option>
                </select>
                @if (newCourseLevel.invalid && newCourseLevel.touched) {
                  <span class="mg-field-error" id="new-course-level-error">Escolha o nível.</span>
                }
                <label for="new-course-duration">Duração do novo curso (anos)</label
                ><input
                  id="new-course-duration"
                  type="number"
                  min="1"
                  max="6"
                  step="1"
                  [formControl]="newCourseDuration"
                  [attr.aria-invalid]="
                    newCourseDuration.invalid && newCourseDuration.touched ? 'true' : null
                  "
                  aria-describedby="new-course-duration-error"
                />
                @if (newCourseDuration.invalid && newCourseDuration.touched) {
                  <span class="mg-field-error" id="new-course-duration-error"
                    >Use um número de 1 a 6 anos.</span
                  >
                }
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
            <label class="field mg-field"
              >Ano de ingresso *
              <input
                type="number"
                formControlName="entryYear"
                min="1990"
                step="1"
                [attr.aria-invalid]="
                  form.controls.entryYear.invalid && form.controls.entryYear.touched ? 'true' : null
                "
                aria-describedby="resident-entry-year-error"
              />
              @if (form.controls.entryYear.invalid && form.controls.entryYear.touched) {
                <span class="mg-field-error" id="resident-entry-year-error">{{
                  form.controls.entryYear.errors?.['fieldRule']
                }}</span>
              }
            </label>
            <label class="field mg-field"
              >Prorrogação (semestres)
              <input
                type="number"
                formControlName="extraSemesters"
                min="0"
                max="10"
                step="1"
                [attr.aria-invalid]="
                  form.controls.extraSemesters.invalid && form.controls.extraSemesters.touched
                    ? 'true'
                    : null
                "
                aria-describedby="resident-extra-semesters-help resident-extra-semesters-error"
              />
              <small class="field-hint" id="resident-extra-semesters-help"
                >Cada semestre adiciona 6 meses à previsão de formatura.</small
              >
              @if (form.controls.extraSemesters.invalid && form.controls.extraSemesters.touched) {
                <span class="mg-field-error" id="resident-extra-semesters-error">{{
                  form.controls.extraSemesters.errors?.['fieldRule']
                }}</span>
              }
            </label>
            @if (!editId) {
              <div class="mg-field">
                <label for="resident-password">Senha escolhida pelo residente *</label>
                <sager-password-field>
                  <input
                    id="resident-password"
                    type="password"
                    formControlName="password"
                    [attr.aria-invalid]="
                      form.controls.password.invalid && form.controls.password.touched
                        ? 'true'
                        : null
                    "
                    aria-describedby="resident-password-help resident-password-error"
                    autocomplete="new-password"
                    required
                  />
                </sager-password-field>
                <small class="field-hint" id="resident-password-help">{{ passwordHelp }}</small>
                @if (form.controls.password.invalid && form.controls.password.touched) {
                  <span class="mg-field-error" id="resident-password-error">{{
                    form.controls.password.errors?.['passwordRules']
                  }}</span>
                }
              </div>
              <div class="mg-field">
                <label for="resident-password-confirmation">Confirmar senha *</label>
                <sager-password-field>
                  <input
                    id="resident-password-confirmation"
                    type="password"
                    formControlName="passwordConfirmation"
                    autocomplete="new-password"
                    required
                  />
                </sager-password-field>
              </div>
            }
          </div>
          <div class="mg-note">
            <span class="material-symbols-rounded" aria-hidden="true">info</span>
            <p>
              @if (isDemo()) {
                Depois de salvar, você poderá adicionar responsáveis e escolher o quarto. Dados
                médicos não são exibidos nesta demonstração.
              } @else {
                Depois de salvar, você poderá adicionar responsáveis e escolher o quarto.
              }
            </p>
          </div>
          @if (error()) {
            <p class="mg-alert" role="alert">{{ error() }}</p>
          }
          @if (conflict()) {
            <button type="button" class="btn mg-secondary" (click)="reloadLatest()">
              Recarregar dados
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
  readonly coursesError = signal('');
  readonly addingCourse = signal(false);
  readonly courseSaving = signal(false);
  readonly newCourse = new FormControl('', {
    nonNullable: true,
    validators: [trimmedLength(1, 200)],
  });
  readonly newCourseLevel = new FormControl<CourseLevel | ''>('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly newCourseDuration = new FormControl<number | null>(null, {
    validators: [
      Validators.required,
      Validators.min(1),
      Validators.max(6),
      Validators.pattern(/^\d+$/),
    ],
  });
  readonly visibleCourses = computed(() =>
    this.courses().filter((c) => c.id === this.form.controls.courseId.value || c.active),
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
    const fields = [this.newCourse, this.newCourseLevel, this.newCourseDuration];
    if (fields.some((field) => field.invalid)) {
      fields.forEach((field) => field.markAsTouched());
      return;
    }
    this.courseSaving.set(true);
    this.coursesError.set('');
    try {
      const course = await this.coursesApi.save({
        name: this.newCourse.value,
        level: this.newCourseLevel.value || null,
        durationYears: this.newCourseDuration.value,
      });
      if (this.destroyRef.destroyed) return;
      this.courses.update((items) => [...items, course]);
      this.form.controls.courseId.setValue(course.id);
      this.form.markAsDirty();
      fields.forEach((field) => field.reset());
      this.addingCourse.set(false);
    } catch (error) {
      if (!this.destroyRef.destroyed) this.coursesError.set(readableError(error));
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
  readonly today = civilToday();
  readonly passwordHelp = PASSWORD_HELP;
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [fieldRule(nameProblem, () => this.resident()?.name)],
    }),
    enrollment: new FormControl('', {
      nonNullable: true,
      validators: [fieldRule(residentEnrollmentProblem, () => this.resident()?.enrollment)],
    }),
    birthDate: new FormControl('', {
      nonNullable: true,
      validators: [fieldRule(birthDateProblem, () => this.resident()?.birthDate)],
    }),
    courseId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    institutionalEmail: new FormControl('', {
      nonNullable: true,
      validators: [
        fieldRule(residentEmailProblem, () => this.resident()?.institutionalEmail),
        Validators.maxLength(320),
      ],
    }),
    entryYear: new FormControl<number | null>(null, {
      validators: [
        fieldRule(entryYearProblem, () => {
          const saved = this.localResident()?.entryYear;
          return saved == null ? null : String(saved);
        }),
      ],
    }),
    extraSemesters: new FormControl(0, {
      nonNullable: true,
      validators: [fieldRule(extraSemestersProblem)],
    }),
    password: new FormControl('', { nonNullable: true }),
    passwordConfirmation: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.newCourse.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value) this.form.markAsDirty();
    });
    void this.loadCourses();
    this.form.controls.enrollment.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const year = yearFromEnrollment(value);
      if (year && this.form.controls.entryYear.value == null) {
        this.form.controls.entryYear.setValue(year);
      }
    });
    if (!this.editId) {
      this.form.controls.password.setValidators(passwordRules('enrollment', normalizeEnrollment));
      this.form.controls.passwordConfirmation.setValidators(Validators.required);
      this.form.controls.enrollment.valueChanges
        .pipe(takeUntilDestroyed())
        .subscribe(() => this.form.controls.password.updateValueAndValidity());
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
          ? 'Não encontramos este cadastro. Volte à lista e tente de novo.'
          : ERROR_GENERIC,
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
    const mismatch = !this.editId && fields.password !== fields.passwordConfirmation;
    if (mismatch) this.error.set(PASSWORD_MISMATCH);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (mismatch) return;
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
      entryYear,
      extraSemesters,
      password,
      passwordConfirmation,
    } = this.form.getRawValue();
    const input: ResidentPayload = {
      name,
      enrollment,
      birthDate,
      courseId,
      institutionalEmail: institutionalEmail || null,
      entryYear,
      extraSemesters,
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
          stale ? ERROR_CONFLICT : 'Já existe um cadastro com esta matrícula. Confira os dados.',
        );
      } else if (error instanceof ResidentApiError && error.status === 400) {
        this.error.set('Os dados foram recusados. Confira os campos e tente novamente.');
      } else if (error instanceof ResidentApiError && error.status === 404) {
        this.error.set('O cadastro não existe mais. Volte à lista de residentes.');
      } else if (error instanceof ResidentApiError && error.status === 401) {
        this.error.set(ERROR_SESSION);
      } else if (error instanceof ResidentApiError && error.status === 403) {
        this.error.set(ERROR_FORBIDDEN);
      } else {
        this.error.set(ERROR_GENERIC);
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
    entryYear?: number | null;
    extraSemesters?: number;
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
      entryYear: item.entryYear ?? yearFromEnrollment(item.enrollment),
      extraSemesters: item.extraSemesters ?? 0,
      password: '',
      passwordConfirmation: '',
    });
  }
}

/** Sugestão do ano de ingresso: os 4 primeiros dígitos da matrícula SUAP. */
function yearFromEnrollment(enrollment: string): number | null {
  const year = /^\s*(\d{4})/.exec(enrollment)?.[1];
  return year ? Number(year) : null;
}
