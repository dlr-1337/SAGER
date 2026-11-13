import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { FilterState } from '../../core/filter-state';
import { FilterChip, FilterPanelComponent } from '../../shared/filter-panel.component';
import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { ResidentApiService, ResidentRecord } from '../management/resident-api.service';
import {
  categoryLabels,
  formatCivilDate,
  notificationLabels,
  severityLabels,
} from './communications-local.utils';

const labels: Record<string, string> = {
  search: 'Busca',
  from: 'De',
  to: 'Até',
  status: 'Situação',
  category: 'Categoria',
  severity: 'Gravidade',
  acknowledged: 'Marcou "Estou ciente"',
  residentId: 'Residente',
};

/**
 * Painel único das listas de comunicação. Fica só dentro dos blocos `!session.active()` das
 * páginas, então nunca chama a API na demonstração.
 */
@Component({
  selector: 'sager-communication-filters',
  standalone: true,
  imports: [ReactiveFormsModule, FilterPanelComponent, SearchableSelectDirective],
  template: `<sager-filter-panel
      [heading]="heading()"
      [key]="'communication-' + mode()"
      [chips]="active()"
      (remove)="form.get($event)?.setValue('')"
      (clear)="clear()"
    >
      <div filterMain class="op-filters" [formGroup]="form">
        <label class="field"
          >{{ mode() === 'notices' || mode() === 'own' ? 'Título' : 'Nome ou matrícula'
          }}<input type="search" formControlName="search" maxlength="200"
        /></label>
      </div>
      <div class="op-filters" [formGroup]="form">
        @if (withResident()) {
          <label class="field"
            >Residente<select sagerSearchable formControlName="residentId">
              <option value="">Todos os residentes</option>
              @for (resident of residents(); track resident.id) {
                <option [value]="resident.id">
                  {{ resident.name }} · {{ resident.enrollment }}
                </option>
              }
            </select></label
          >
        }
        <label class="field">Data inicial<input type="date" formControlName="from" /></label
        ><label class="field">Data final<input type="date" formControlName="to" /></label>
        <label class="field"
          >Situação<select formControlName="status">
            <option value="">Todas</option>
            @for (status of statuses(); track status[0]) {
              <option [value]="status[0]">{{ status[1] }}</option>
            }
          </select></label
        >
        @if (withResident()) {
          <label class="field"
            >Categoria<select formControlName="category">
              <option value="">Todas</option>
              @for (category of categories; track category[0]) {
                <option [value]="category[0]">{{ category[1] }}</option>
              }
            </select></label
          >
        }
        @if (mode() === 'warnings') {
          <label class="field"
            >Gravidade<select formControlName="severity">
              <option value="">Todas</option>
              @for (severity of severities; track severity[0]) {
                <option [value]="severity[0]">{{ severity[1] }}</option>
              }
            </select></label
          >
        }
        @if (mode() === 'own') {
          <label class="field"
            >Marcou "Estou ciente"?<select formControlName="acknowledged">
              <option value="">Todos</option>
              <option value="true">Sim</option>
              <option value="false">Ainda não</option>
            </select></label
          >
        }
      </div>
    </sager-filter-panel>
    @if (error()) {
      <p class="comm-error" role="alert">{{ error() }}</p>
    }`,
  styleUrl: './communications-local.scss',
})
export class CommunicationFiltersComponent implements OnInit {
  readonly mode = input<'notices' | 'warnings' | 'notifications' | 'own'>('notices');
  readonly heading = input('Filtrar');
  /** Residente vindo do link (por exemplo, `?residente=`), que prevalece sobre o lembrado. */
  readonly resident = input('');
  readonly changed = output<Record<string, string>>();
  private readonly state = inject(FilterState);
  private readonly destroy = inject(DestroyRef);
  private readonly registry = inject(ResidentApiService);
  readonly error = signal('');
  readonly residents = signal<ResidentRecord[]>([]);
  private readonly applied = signal<Record<string, string>>({});
  readonly categories = Object.entries(categoryLabels);
  readonly severities = Object.entries(severityLabels);
  readonly withResident = computed(
    () => this.mode() === 'warnings' || this.mode() === 'notifications',
  );
  readonly form = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    residentId: new FormControl('', { nonNullable: true }),
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
    category: new FormControl('', { nonNullable: true }),
    severity: new FormControl('', { nonNullable: true }),
    acknowledged: new FormControl('', { nonNullable: true }),
  });
  readonly active = computed<FilterChip[]>(() =>
    Object.entries(this.applied()).map(([key, value]) => ({
      key,
      label: labels[key],
      value: this.readable(key, value),
    })),
  );
  statuses(): string[][] {
    return this.mode() === 'notifications'
      ? Object.entries(notificationLabels)
      : this.mode() === 'warnings'
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
              ['SUPERADO', 'Versão anterior'],
              ['ANULADO', 'Anulado'],
            ];
  }
  ngOnInit(): void {
    const previous = this.state.values.get('communication-' + this.mode());
    if (previous) this.form.patchValue(previous as Record<string, string>);
    if (this.resident()) this.form.controls.residentId.setValue(this.resident());
    // Uma emissão no início, com o filtro lembrado ou vazio: a página só carrega depois dela.
    this.apply();
    this.form.valueChanges
      .pipe(debounceTime(250), takeUntilDestroyed(this.destroy))
      .subscribe(() => this.apply());
    if (this.withResident())
      this.registry
        .list()
        .then((residents) => !this.destroy.destroyed && this.residents.set(residents))
        .catch(
          () =>
            !this.destroy.destroyed &&
            this.error.set('Não foi possível carregar a lista de residentes para o filtro.'),
        );
  }
  apply(): void {
    const input = this.form.getRawValue();
    this.error.set('');
    if (input.from && input.to && input.from > input.to) {
      this.error.set('A data inicial deve ser anterior ou igual à final.');
      return;
    }
    this.state.values.set('communication-' + this.mode(), input);
    const filters = Object.fromEntries(Object.entries(input).filter(([, value]) => !!value));
    this.applied.set(filters);
    this.changed.emit(filters);
  }
  clear(): void {
    this.form.reset(undefined, { emitEvent: false });
    this.apply();
  }
  private readable(key: string, value: string): string {
    if (key === 'from' || key === 'to') return formatCivilDate(value);
    if (key === 'acknowledged') return value === 'true' ? 'Sim' : 'Ainda não';
    if (key === 'status') return this.statuses().find(([code]) => code === value)?.[1] ?? value;
    if (key === 'category') return categoryLabels[value as keyof typeof categoryLabels] ?? value;
    if (key === 'severity') return severityLabels[value as keyof typeof severityLabels] ?? value;
    if (key === 'residentId') {
      const resident = this.residents().find((item) => item.id === value);
      return resident ? `${resident.name} · ${resident.enrollment}` : 'Residente selecionado';
    }
    return value;
  }
}
