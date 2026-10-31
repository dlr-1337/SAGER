import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CleaningCriteria } from './cleaning-local.models';
import { criteriaKeys, criterionLabels } from './cleaning-local.utils';
export function criteriaForm() {
  return new FormGroup({
    PISO: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(10),
    ]),
    SUPERFICIES: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(10),
    ]),
    RESIDUOS: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(10),
    ]),
    ORGANIZACAO: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(10),
    ]),
  });
}
export type CriteriaForm = ReturnType<typeof criteriaForm>;
export function criteriaInput(form: CriteriaForm): CleaningCriteria {
  return form.getRawValue() as CleaningCriteria;
}
@Component({
  standalone: true,
  selector: 'sager-cleaning-criteria-fields',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="cleaning-criteria" [formGroup]="form">
    @for (key of keys; track key) {
      <label class="field"
        >{{ labels[key]
        }}<input
          type="number"
          min="0"
          max="10"
          step="0.1"
          inputmode="decimal"
          [formControlName]="key"
        />
        @if (form.controls[key].touched && form.controls[key].invalid) {
          <span class="field-error">Informe uma nota de 0 a 10.</span>
        }
        <span class="field-hint">Nota de 0 a 10.</span></label
      >
    }
  </div>`,
  styleUrl: './cleaning-local.scss',
})
export class CleaningCriteriaFieldsComponent {
  @Input({ required: true }) form!: CriteriaForm;
  readonly keys = criteriaKeys;
  readonly labels = criterionLabels;
}
