import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { FilterState } from '../../core/filter-state';
@Component({
  selector: 'sager-communication-filters',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: ` <section class="panel op-panel">
    <h2>Filtrar registros</h2>
    <form class="op-filters" [formGroup]="form" (ngSubmit)="apply()">
      <label class="field"
        >{{ mode() === 'notices' || mode() === 'own' ? 'Título' : 'Nome ou matrícula'
        }}<input type="search" formControlName="search" maxlength="200"
      /></label>
      <label class="field">Data inicial<input type="date" formControlName="from" /></label
      ><label class="field">Data final<input type="date" formControlName="to" /></label>
      @if (mode() !== 'notifications') {
        <label class="field"
          >Situação<select formControlName="status">
            <option value="">Todas</option>
            @for (status of statuses(); track status[0]) {
              <option [value]="status[0]">{{ status[1] }}</option>
            }
          </select></label
        >
      }
      @if (mode() === 'warnings' || mode() === 'notifications') {
        <label class="field"
          >Categoria<select formControlName="category">
            <option value="">Todas</option>
            <option value="AUSENCIA">Ausência</option>
            <option value="ATRASO_RETORNO">Atraso de retorno</option>
            <option value="LIMPEZA">Limpeza</option>
            <option value="OUTRA">Outra</option>
          </select></label
        >
      }
      @if (mode() === 'warnings') {
        <label class="field"
          >Gravidade<select formControlName="severity">
            <option value="">Todas</option>
            <option value="LEVE">Leve</option>
            <option value="MODERADA">Moderada</option>
            <option value="GRAVE">Grave</option>
          </select></label
        >
      }
      @if (mode() === 'own') {
        <label class="field"
          >Ciência<select formControlName="acknowledged">
            <option value="">Todas</option>
            <option value="true">Registrada</option>
            <option value="false">Pendente</option>
          </select></label
        >
      }
      <button class="btn-secondary" type="button" (click)="clear()">Limpar filtros</button>
    </form>
    @if (error()) {
      <p class="comm-error" role="alert">{{ error() }}</p>
    }
    @if (active().length) {
      <ul class="filter-chips" aria-label="Filtros aplicados">
        @for (chip of active(); track chip.key) {
          <li>
            <button
              type="button"
              [attr.aria-label]="'Remover filtro ' + chip.label"
              (click)="form.get(chip.key)?.setValue('')"
            >
              {{ chip.label }}: {{ chip.value }}
              <span class="material-symbols-rounded" aria-hidden="true">close</span>
            </button>
          </li>
        }
      </ul>
    }
  </section>`,
  styleUrl: './communications-local.scss',
})
export class CommunicationFiltersComponent implements OnInit {
  readonly mode = input<'notices' | 'warnings' | 'notifications' | 'own'>('notices');
  readonly changed = output<Record<string, string>>();
  private readonly state = inject(FilterState);
  private readonly destroy = inject(DestroyRef);
  readonly error = signal('');
  readonly active = signal<{ key: string; label: string; value: string }[]>([]);
  readonly form = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
    category: new FormControl('', { nonNullable: true }),
    severity: new FormControl('', { nonNullable: true }),
    acknowledged: new FormControl('', { nonNullable: true }),
  });
  statuses(): string[][] {
    return this.mode() === 'warnings'
      ? [
          ['VIGENTE', 'Ativa'],
          ['ANULADA', 'Anulada'],
        ]
      : this.mode() === 'notices'
        ? [
            ['RASCUNHO', 'Rascunho'],
            ['PUBLICADO', 'Publicado'],
            ['RETIRADO', 'Retirado'],
          ]
        : [
            ['PUBLICADO', 'Publicado'],
            ['RETIRADO', 'Retirado'],
            ['SUPERADO', 'Superado'],
            ['ANULADO', 'Anulado'],
          ];
  }
  ngOnInit(): void {
    const previous = this.state.values.get('communication-' + this.mode());
    if (previous) {
      this.form.patchValue(previous as Record<string, string>);
      this.apply();
    }
    this.form.valueChanges
      .pipe(debounceTime(250), takeUntilDestroyed(this.destroy))
      .subscribe(() => this.apply());
  }
  apply(): void {
    const input = this.form.getRawValue();
    this.error.set('');
    if (input.from && input.to && input.from > input.to) {
      this.error.set('A data inicial deve ser anterior ou igual à final.');
      return;
    }
    this.state.values.set('communication-' + this.mode(), input);
    const labels: Record<string, string> = {
      search: 'Busca',
      from: 'De',
      to: 'Até',
      status: 'Situação',
      category: 'Categoria',
      severity: 'Gravidade',
      acknowledged: 'Ciência',
    };
    this.active.set(
      Object.entries(input)
        .filter(([, v]) => !!v)
        .map(([key, value]) => ({
          key,
          label: labels[key],
          value: key === 'acknowledged' ? (value === 'true' ? 'Registrada' : 'Pendente') : value,
        })),
    );
    this.changed.emit(Object.fromEntries(Object.entries(input).filter(([, v]) => !!v)));
  }
  clear(): void {
    this.form.reset();
    this.apply();
  }
}
