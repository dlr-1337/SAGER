import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { CommunicationsStateComponent } from '../communications/communications-local.shared';
import { ResidentApiService, ResidentRecord } from '../management/resident-api.service';
import { periodError } from '../reports/reports-local.utils';
import { CleaningLocalApiService } from './cleaning-local-api.service';
import { MonthlyIndicator } from './cleaning-local.models';
import { MonthlyIndicatorsComponent } from './monthly-indicators.component';
import { reportingError } from './reporting-local.transport';

@Component({
  standalone: true,
  selector: 'sager-cleaning-indicators-local',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    CommunicationsStateComponent,
    MonthlyIndicatorsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="page op-page comm-narrow">
    <header class="op-heading">
      <div>
        <a class="op-back" routerLink="/relatorios">← Relatórios</a>
        <h1>Indicadores individuais</h1>
        <p>
          Consulte ausências sem justificativa, retornos físicos com atraso e advertências vigentes
          por mês.
        </p>
      </div>
    </header>
    <sager-communications-state
      [demo]="session.active()"
      [blocked]="!allowed()"
      [loading]="loading()"
      [error]="error()"
      (retry)="load()"
    />
    @if (!session.active() && allowed() && !loading() && !error()) {
      <section class="panel op-panel">
        <h2>Residente e período</h2>
        <form class="comm-form-grid" [formGroup]="form" (ngSubmit)="load()">
          <label class="field"
            >Residente<select formControlName="residentId">
              <option value="">Selecione um residente</option>
              @for (resident of residents(); track resident.id) {
                <option [value]="resident.id">
                  {{ resident.name }} · {{ resident.enrollment }}
                </option>
              }
            </select></label
          ><label class="field">Data inicial<input type="date" formControlName="from" /></label
          ><label class="field">Data final<input type="date" formControlName="to" /></label
          ><button class="btn-secondary" type="submit">Consultar indicadores</button>
        </form>
        @if (filterError()) {
          <p class="comm-error" role="alert">{{ filterError() }}</p>
        }
      </section>
      @if (consulted()) {
        <section class="panel op-panel op-section">
          <h2>{{ residentName() }}</h2>
          <sager-monthly-indicators [items]="items()" />
        </section>
      }
    }
  </main>`,
  styleUrl: './cleaning-local.scss',
})
export class CleaningIndicatorsLocalPage {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(CleaningLocalApiService);
  private readonly residentApi = inject(ResidentApiService);
  private readonly route = inject(ActivatedRoute);
  readonly form = new FormGroup({
    residentId: new FormControl(this.route.snapshot.paramMap.get('id') ?? '', {
      nonNullable: true,
    }),
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
  });
  readonly residents = signal<ResidentRecord[]>([]);
  readonly items = signal<MonthlyIndicator[]>([]);
  readonly residentName = signal('Indicadores mensais');
  readonly consulted = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly filterError = signal('');
  constructor() {
    void this.load();
  }
  allowed(): boolean {
    return this.session.hasRole('gestor', 'supervisor');
  }
  async load(): Promise<void> {
    if (this.session.active() || !this.allowed()) return;
    this.loading.set(true);
    this.error.set('');
    this.filterError.set('');
    try {
      const [policy, residents] = await Promise.all([this.api.policy(), this.residentApi.list()]);
      this.residents.set(residents);
      if (!this.form.controls.to.value)
        this.form.patchValue({
          from: policy.currentDate.slice(0, 8) + '01',
          to: policy.currentDate,
        });
      const value = this.form.getRawValue();
      if (!residents.some((resident) => resident.id === value.residentId)) {
        this.consulted.set(false);
        if (value.residentId) this.filterError.set('Selecione um residente cadastrado.');
        return;
      }
      const error = periodError(value.from, value.to);
      if (error) {
        this.filterError.set(error);
        return;
      }
      const items = await this.api.indicators(value.from, value.to, value.residentId);
      this.items.set(items);
      this.residentName.set(
        residents.find((resident) => resident.id === value.residentId)?.name ??
          'Indicadores mensais',
      );
      this.consulted.set(true);
    } catch (error) {
      this.error.set(reportingError(error));
      this.consulted.set(false);
    } finally {
      this.loading.set(false);
    }
  }
}
