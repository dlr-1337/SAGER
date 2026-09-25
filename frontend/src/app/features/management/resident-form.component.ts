import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';

@Component({
  selector: 'app-resident-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page mg-narrow">
      @if (!canEdit()) {
        <section class="mg-empty" role="alert"><span class="material-symbols-rounded" aria-hidden="true">lock</span><h1>Acesso restrito</h1><p>O cadastro de residentes está disponível ao gestor nesta demonstração. A permissão de edição do supervisor depende de definição da AE/TI.</p><a class="btn mg-primary" routerLink="/residentes">Voltar aos residentes</a></section>
      } @else if (editId && !resident()) {
        <section class="mg-empty" role="alert"><h1>Residente não encontrado</h1><p>O cadastro solicitado não está disponível nesta demonstração.</p><a class="btn mg-primary" routerLink="/residentes">Voltar aos residentes</a></section>
      } @else {
        <header class="mg-heading"><div><a class="mg-back" routerLink="/residentes"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Residentes</a><h1>{{ editId ? 'Editar residente' : 'Cadastrar residente' }}</h1><p>Preencha os dados de identificação e vínculo acadêmico.</p></div></header>
        <form class="panel mg-panel mg-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <h2>Dados do residente</h2>
          <p class="mg-muted">Campos marcados com * são obrigatórios. Estes dados são fictícios e ficam somente nesta demonstração.</p>
          <div class="form-grid mg-form-grid">
            <label class="field mg-field mg-span-2" [class.mg-invalid]="form.controls.name.invalid && form.controls.name.touched">Nome completo *
              <input formControlName="name" autocomplete="name" aria-describedby="resident-name-error" />
              @if (form.controls.name.invalid && form.controls.name.touched) { <span class="mg-field-error" id="resident-name-error">Informe o nome completo com pelo menos 3 caracteres.</span> }
            </label>
            <label class="field mg-field" [class.mg-invalid]="form.controls.enrollment.invalid && form.controls.enrollment.touched">Matrícula *
              <input formControlName="enrollment" autocomplete="off" aria-describedby="resident-enrollment-error" />
              @if (form.controls.enrollment.invalid && form.controls.enrollment.touched) { <span class="mg-field-error" id="resident-enrollment-error">Informe a matrícula vinculada ao residente.</span> }
            </label>
            <label class="field mg-field" [class.mg-invalid]="form.controls.birthDate.invalid && form.controls.birthDate.touched">Data de nascimento *
              <input type="date" formControlName="birthDate" [max]="today" aria-describedby="resident-birth-error" />
              @if (form.controls.birthDate.invalid && form.controls.birthDate.touched) { <span class="mg-field-error" id="resident-birth-error">Informe uma data de nascimento válida.</span> }
            </label>
            <label class="field mg-field mg-span-2" [class.mg-invalid]="form.controls.course.invalid && form.controls.course.touched">Curso *
              <input formControlName="course" autocomplete="off" aria-describedby="resident-course-error" />
              @if (form.controls.course.invalid && form.controls.course.touched) { <span class="mg-field-error" id="resident-course-error">Informe o curso do residente.</span> }
            </label>
          </div>
          <div class="mg-note"><span class="material-symbols-rounded" aria-hidden="true">info</span><p>A alocação ou transferência entre quartos depende das regras da AE. Responsáveis legais podem ser vinculados depois de salvar o residente. Dados médicos não são exibidos neste protótipo.</p></div>
          @if (error()) { <p class="mg-alert" role="alert">{{ error() }}</p> }
          <div class="action-row mg-actions"><a class="btn mg-secondary" [routerLink]="editId ? ['/residentes', editId] : ['/residentes']">Cancelar</a><button class="btn mg-primary" type="submit"><span class="material-symbols-rounded" aria-hidden="true">save</span> Salvar residente</button></div>
        </form>
      }
    </main>
  `,
})
export class ResidentFormComponent {
  private readonly service = inject(ManagementDemoService);
  private readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly editId = this.route.snapshot.paramMap.get('id');
  readonly canEdit = computed(() => this.session.hasRole('gestor'));
  readonly resident = computed(() => this.editId ? this.service.resident(this.editId) : undefined);
  readonly error = signal('');
  readonly today = new Date().toISOString().slice(0, 10);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    enrollment: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    birthDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    course: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    const existing = this.resident();
    if (existing) this.form.setValue({ name: existing.name, enrollment: existing.enrollment, birthDate: existing.birthDate, course: existing.course });
  }

  save(): void {
    this.error.set('');
    if (!this.canEdit()) return;
    if (this.form.invalid || this.form.controls.birthDate.value > this.today) {
      this.form.markAllAsTouched();
      if (this.form.controls.birthDate.value > this.today) this.form.controls.birthDate.setErrors({ future: true });
      return;
    }
    try {
      const saved = this.service.saveResident(this.form.getRawValue(), this.editId ?? undefined);
      void this.router.navigate(['/residentes', saved.id], { queryParams: { saved: '1' } });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Não foi possível salvar o residente. Tente novamente.');
    }
  }
}
