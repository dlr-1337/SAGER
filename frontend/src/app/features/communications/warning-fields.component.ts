import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { trimmedLength } from '../../shared/field-rules';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DisciplineCategory, WarningInput, WarningSeverity } from './communications-local.models';
import { categoryLabels, severityLabels } from './communications-local.utils';

export function warningForm() {
  return new FormGroup({
    category: new FormControl<DisciplineCategory>('AUSENCIA', {
      nonNullable: true,
      validators: Validators.required,
    }),
    severity: new FormControl<WarningSeverity>('LEVE', {
      nonNullable: true,
      validators: Validators.required,
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [trimmedLength(3, 1800)],
    }),
    justification: new FormControl('', {
      nonNullable: true,
      validators: [trimmedLength(10, 1800)],
    }),
    warningDate: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
}
export type WarningForm = ReturnType<typeof warningForm>;
export function warningInput(form: WarningForm): WarningInput {
  const value = form.getRawValue();
  return {
    ...value,
    description: value.description.trim(),
    justification: value.justification.trim(),
  };
}

@Component({
  standalone: true,
  selector: 'sager-warning-fields',
  imports: [SearchableSelectDirective, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="comm-form" [formGroup]="form">
      <div class="comm-form-grid">
        @if (lockedCategory) {
          <div>
            <strong>Categoria vinculada à origem</strong>
            <p>{{ categories[form.controls.category.value] }}</p>
          </div>
        } @else {
          <label class="field"
            >Categoria<select sagerSearchable formControlName="category">
              @for (item of categoryOptions; track item) {
                <option [value]="item">{{ categories[item] }}</option>
              }
            </select></label
          >
        }
        <label class="field"
          >Gravidade decidida pelo supervisor<select sagerSearchable formControlName="severity">
            @for (item of severityOptions; track item) {
              <option [value]="item">{{ severities[item] }}</option>
            }
          </select></label
        >
      </div>
      <label class="field"
        >Data da advertência<input type="date" formControlName="warningDate" [max]="maxDate" />
        @if (form.controls.warningDate.touched && form.controls.warningDate.invalid) {
          <span class="field-error">Informe a data.</span>
        }
        <span class="field-hint">Não pode ser uma data futura.</span></label
      >
      <label class="field"
        >O que aconteceu?<textarea
          rows="4"
          maxlength="1800"
          formControlName="description"
        ></textarea>
        @if (form.controls.description.touched && form.controls.description.invalid) {
          <span class="field-error">Descreva a ocorrência em 3 a 1.800 caracteres.</span>
        }
      </label>
      <label class="field"
        >Justificativa da decisão<textarea
          rows="4"
          maxlength="1800"
          formControlName="justification"
        ></textarea>
        @if (form.controls.justification.touched && form.controls.justification.invalid) {
          <span class="field-error">Explique a decisão em 10 a 1.800 caracteres.</span>
        }
      </label>
    </div>
  `,
  styleUrl: './communications-local.scss',
})
export class WarningFieldsComponent {
  @Input({ required: true }) form!: WarningForm;
  @Input() maxDate = '';
  @Input() lockedCategory = false;
  readonly categories = categoryLabels;
  readonly severities = severityLabels;
  readonly categoryOptions = Object.keys(categoryLabels) as DisciplineCategory[];
  readonly severityOptions = Object.keys(severityLabels) as WarningSeverity[];
}
