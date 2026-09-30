import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { OperationsApiError, operationsError } from './operations-local-api.service';
import {
  eligibilityBlocker,
  formatOperationsTime,
  saoPauloInput,
  saoPauloInstant,
} from './operations-local.utils';
import { LongExitApiService } from './long-exit-api.service';
import { LongExit, LongExitEligibility, LongExitInput } from './long-exit.models';
import { guardianBlocker, longExitFormError } from './long-exit.utils';

@Component({
  standalone: true,
  selector: 'app-long-exit-form',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page op-narrow">
      <header class="op-heading">
        <div>
          <a routerLink="/saidas" [queryParams]="{ tipo: 'longa' }" class="op-back"
            >← Saídas longas</a
          >
          <h1>{{ editing ? 'Editar saída longa' : 'Solicitar saída longa' }}</h1>
          <p>Informe o período e escolha o responsável que receberá o convite para assinatura.</p>
        </div>
      </header>
      @if (session.active()) {
        <section class="op-empty" role="status">
          <h2>Área do ambiente local</h2>
          <p>Na demonstração, use as solicitações demonstrativas da lista de saídas.</p>
          <a class="btn op-primary" routerLink="/saidas">Abrir demonstração de saídas</a>
        </section>
      } @else if (!session.hasRole('residente')) {
        <section class="op-empty" role="alert">
          <h2>Acesso restrito</h2>
          <p>O pedido é feito pelo próprio residente menor de idade.</p>
        </section>
      } @else if (loading()) {
        <section class="op-state" role="status">
          <h2>Carregando dados da solicitação</h2>
          <p>Verificando o cadastro e os responsáveis disponíveis.</p>
        </section>
      } @else if (loadError()) {
        <section class="op-state" role="alert">
          <h2>Não foi possível carregar a solicitação</h2>
          <p>{{ loadError() }}</p>
          <button class="btn op-secondary" type="button" (click)="load()">Tentar novamente</button>
        </section>
      } @else if (eligibility(); as resident) {
        @if (!resident.eligible || !eligibleGuardianCount()) {
          <section class="op-empty" role="alert">
            <h2>Solicitação indisponível</h2>
            <ul>
              @for (blocker of resident.blockers; track blocker) {
                <li>{{ blockerLabel(blocker) }}</li>
              }
              @if (!eligibleGuardianCount()) {
                <li>
                  É necessário um responsável ativo, vinculado e com telefone válido no Brasil.
                </li>
              }
            </ul>
            <p>Solicite a atualização do cadastro à equipe responsável pela residência.</p>
          </section>
        } @else if (editing && !original()?.capabilities?.canEdit) {
          <section class="op-empty" role="alert">
            <h2>Edição indisponível</h2>
            <p>
              Somente uma solicitação própria aguardando análise pode ser alterada antes da partida
              e dentro do prazo.
            </p>
          </section>
        } @else {
          <form class="panel op-panel op-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
            <h2>Dados da saída longa</h2>
            <p>
              {{ resident.residentName }} · Matrícula {{ resident.enrollment }} · Quarto
              {{ resident.roomNumber }}
            </p>
            <p class="op-help">
              Saídas longas duram mais de 3 horas. Uma assinatura válida de um responsável elegível
              é necessária antes da aprovação pelo supervisor.
            </p>
            <div class="op-form-grid">
              <label class="field"
                >Quando deseja sair?<select
                  formControlName="departureMode"
                  (change)="departureChanged()"
                >
                  <option value="NOW">
                    Agora, após assinatura, análise e liberação presencial
                  </option>
                  <option value="SCHEDULED">Agendar data e hora</option>
                </select></label
              ><label class="field"
                >Responsável para o convite<select formControlName="guardianId" required>
                  <option value="">Selecione um responsável</option>
                  @for (guardian of resident.guardians; track guardian.id) {
                    <option [value]="guardian.id" [disabled]="!guardian.eligible">
                      {{ guardian.name }} · {{ guardian.relationship
                      }}{{ guardian.eligible ? '' : ' · cadastro indisponível' }}
                    </option>
                  }
                </select>
                @if (form.controls.guardianId.touched && form.controls.guardianId.invalid) {
                  <span class="op-field-error">Selecione um responsável elegível.</span>
                }
              </label>
            </div>
            @if (hasUnavailableGuardians()) {
              <details class="guardian-check">
                <summary>Responsáveis com cadastro indisponível</summary>
                <ul>
                  @for (guardian of resident.guardians; track guardian.id) {
                    @if (!guardian.eligible) {
                      <li>
                        <strong>{{ guardian.name }}</strong>
                        @for (blocker of guardian.blockers; track blocker) {
                          <span> · {{ guardianBlockerLabel(blocker) }}</span>
                        }
                      </li>
                    }
                  }
                </ul>
              </details>
            }
            <div class="op-form-grid">
              @if (form.controls.departureMode.value === 'SCHEDULED') {
                <label class="field"
                  >Data e hora de saída<input
                    type="datetime-local"
                    formControlName="departure"
                    required
                    (change)="departureChanged()"
                /></label>
              }
              <label class="field"
                >Retorno previsto<input
                  type="datetime-local"
                  formControlName="expectedReturn"
                  required
                />
                @if (form.controls.expectedReturn.touched && form.controls.expectedReturn.invalid) {
                  <span class="op-field-error">Informe a data e hora de retorno.</span>
                }
              </label>
            </div>
            <p class="op-help">
              Horário de Brasília. Última consulta do servidor: {{ formatTime(resident.now) }}. Na
              opção “Agora”, a saída solicitada usa o horário de envio registrado pelo servidor.
            </p>
            <label class="field"
              >Motivo da saída<textarea
                rows="3"
                maxlength="2000"
                formControlName="reason"
                required
              ></textarea>
              @if (form.controls.reason.touched && form.controls.reason.invalid) {
                <span class="op-field-error">Informe um motivo com 3 a 2.000 caracteres.</span>
              }</label
            ><label class="field"
              >Observações (opcional)<textarea
                rows="3"
                maxlength="2000"
                formControlName="notes"
              ></textarea>
            </label>
            @if (!resident.providers.clicksignEnabled) {
              <p class="op-warning">
                O serviço de assinatura está indisponível neste ambiente. O pedido pode ser
                registrado, mas sua aprovação depende de assinatura confirmada posteriormente pelo
                servidor.
              </p>
            }
            @if (!resident.providers.whatsappEnabled) {
              <p class="op-warning">
                O envio de convites pelo WhatsApp está indisponível neste ambiente.
              </p>
            }
            @if (editing) {
              <p class="op-warning">
                Salvar as alterações gera uma nova revisão do documento e invalida os convites e as
                assinaturas da revisão anterior.
              </p>
            }
            @if (error()) {
              <p class="op-error" role="alert">{{ error() }}</p>
            }
            @if (conflict()) {
              <button type="button" class="btn op-secondary" (click)="load()">
                Recarregar solicitação
              </button>
              <p class="op-help">Recarregar substitui os campos pelos dados atuais do servidor.</p>
            }
            <div class="op-actions">
              <a class="btn op-secondary" routerLink="/saidas" [queryParams]="{ tipo: 'longa' }"
                >Cancelar</a
              ><button class="btn op-primary" type="submit" [disabled]="saving() || conflict()">
                {{
                  saving()
                    ? 'Salvando solicitação…'
                    : editing
                      ? 'Salvar alterações e gerar nova revisão'
                      : 'Enviar solicitação de saída longa'
                }}
              </button>
            </div>
          </form>
        }
      }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .guardian-check {
        margin: 18px 0;
      }
      summary {
        min-height: 44px;
        display: flex;
        align-items: center;
        cursor: pointer;
        color: var(--green-800);
        text-decoration: underline;
        text-underline-offset: 0.2em;
      }
      li {
        margin: 8px 0;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class LongExitFormComponent {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(LongExitApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly editing = !!this.id;
  readonly eligibility = signal<LongExitEligibility | null>(null);
  readonly original = signal<LongExit | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly conflict = signal(false);
  readonly formatTime = formatOperationsTime;
  readonly blockerLabel = eligibilityBlocker;
  readonly guardianBlockerLabel = guardianBlocker;
  readonly form = new FormGroup({
    departureMode: new FormControl<'NOW' | 'SCHEDULED'>('NOW', { nonNullable: true }),
    guardianId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    departure: new FormControl('', { nonNullable: true }),
    expectedReturn: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(2000)],
    }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });
  constructor() {
    if (!this.session.active() && this.session.hasRole('residente')) void this.load();
  }
  eligibleGuardianCount(): number {
    return this.eligibility()?.guardians.filter((guardian) => guardian.eligible).length ?? 0;
  }
  hasUnavailableGuardians(): boolean {
    return this.eligibility()?.guardians.some((guardian) => !guardian.eligible) ?? false;
  }
  async load(): Promise<void> {
    if (this.session.active() || !this.session.hasRole('residente') || this.saving()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.conflict.set(false);
    try {
      const [eligibility, original] = await Promise.all([
        this.api.eligibility(),
        this.editing ? this.api.get(this.id) : Promise.resolve(null),
      ]);
      this.eligibility.set(eligibility);
      this.original.set(original);
      const scheduledStart = new Date(
        Math.ceil(Date.parse(eligibility.now) / 60_000) * 60_000,
      ).toISOString();
      this.form.reset({
        departureMode: original?.departureMode ?? 'NOW',
        guardianId: original?.guardianId ?? '',
        departure: saoPauloInput(original?.requestedDepartureAt ?? scheduledStart),
        expectedReturn: saoPauloInput(
          original?.expectedReturnAt ??
            new Date(Date.parse(eligibility.now) + 4 * 3_600_000).toISOString(),
        ),
        reason: original?.reason ?? '',
        notes: original?.notes ?? '',
      });
    } catch (error) {
      this.loadError.set(operationsError(error));
    } finally {
      this.loading.set(false);
    }
  }
  departureChanged(): void {
    this.error.set('');
    const departure =
      this.form.controls.departureMode.value === 'NOW'
        ? this.eligibility()?.now
        : saoPauloInstant(this.form.controls.departure.value);
    if (departure)
      this.form.controls.expectedReturn.setValue(
        saoPauloInput(new Date(Date.parse(departure) + 4 * 3_600_000).toISOString()),
      );
  }
  async save(): Promise<void> {
    const eligibility = this.eligibility();
    const original = this.original();
    if (
      this.session.active() ||
      !this.session.hasRole('residente') ||
      !eligibility?.eligible ||
      (this.editing && !original?.capabilities.canEdit) ||
      this.saving() ||
      this.conflict()
    )
      return;
    this.form.markAllAsTouched();
    this.error.set('');
    if (this.form.invalid) {
      this.error.set('Revise os campos obrigatórios indicados.');
      return;
    }
    const value = this.form.getRawValue();
    const expectedReturnAt = saoPauloInstant(value.expectedReturn);
    const requestedDepartureAt =
      value.departureMode === 'SCHEDULED' ? saoPauloInstant(value.departure) : null;
    if (!expectedReturnAt || (value.departureMode === 'SCHEDULED' && !requestedDepartureAt)) {
      this.error.set('Informe datas e horas válidas no horário de Brasília.');
      return;
    }
    const input: LongExitInput = {
      departureMode: value.departureMode,
      guardianId: value.guardianId,
      expectedReturnAt,
      reason: value.reason.trim(),
      notes: value.notes.trim() || null,
      ...(requestedDepartureAt ? { requestedDepartureAt } : {}),
    };
    const invalid = longExitFormError(input, eligibility.now);
    if (invalid) {
      this.error.set(invalid);
      return;
    }
    if (
      !eligibility.guardians.some(
        (guardian) => guardian.id === input.guardianId && guardian.eligible,
      )
    ) {
      this.error.set(
        'O responsável escolhido não está elegível. Selecione outro cadastro disponível.',
      );
      return;
    }
    this.saving.set(true);
    try {
      const fresh = await this.api.eligibility();
      this.eligibility.set(fresh);
      if (
        !fresh.eligible ||
        !fresh.guardians.some((guardian) => guardian.id === input.guardianId && guardian.eligible)
      ) {
        this.error.set(
          'O cadastro ou o responsável deixou de atender aos requisitos. Revise os dados.',
        );
        return;
      }
      const invalid = longExitFormError(input, fresh.now);
      if (invalid) {
        this.error.set(invalid);
        return;
      }
      const exit = await this.api.save(input, original ?? undefined);
      await this.router.navigate(['/saidas/longas', exit.id], { queryParams: { saved: '1' } });
    } catch (error) {
      this.error.set(operationsError(error));
      if (error instanceof OperationsApiError && error.status === 409) this.conflict.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}
