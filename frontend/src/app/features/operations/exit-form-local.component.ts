import { UnsavedFormDirective } from '../../shared/unsaved-form';
import { trimmedLength } from '../../shared/field-rules';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import {
  OperationsApiError,
  OperationsLocalApiService,
  operationsError,
} from './operations-local-api.service';
import { ExitEligibility, ShortExit, ShortExitInput } from './operations-local.models';
import { eligibilityBlocker, shortExitFormError } from './operations-local.utils';

@Component({
  standalone: true,
  selector: 'app-exit-form-local',
  imports: [UnsavedFormDirective, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page op-narrow">
      <header class="op-heading">
        <div>
          <a routerLink="/saidas" class="op-back"
            ><span class="back-arrow" aria-hidden="true">←</span>Saídas</a
          >
          <h1>{{ editing ? 'Mudar saída curta' : 'Pedir saída curta' }}</h1>
          <p>Diga por que quer sair.</p>
        </div>
      </header>
      @if (!session.hasRole('residente')) {
        <section class="op-empty" role="alert">
          <h2>Acesso restrito</h2>
          <p>O pedido é feito pelo próprio residente menor de idade.</p>
        </section>
      } @else if (loading()) {
        <section class="op-state" role="status">
          <h2>Carregando seu pedido</h2>
          <p>Aguarde um momento.</p>
        </section>
      } @else if (loadError()) {
        <section class="op-state" role="alert">
          <h2>Não foi possível carregar o pedido</h2>
          <p>{{ loadError() }}</p>
          <button type="button" class="btn op-secondary" (click)="load()">Tentar novamente</button>
        </section>
      } @else if (eligibility(); as resident) {
        @if (!resident.eligible) {
          <section class="op-empty" role="alert">
            <h2>Você não pode pedir esta saída agora</h2>
            <ul>
              @for (blocker of resident.blockers; track blocker) {
                <li>{{ blockerLabel(blocker) }}</li>
              }
            </ul>
          </section>
        } @else if (editing && !original()?.capabilities?.canEdit) {
          <section class="op-empty" role="alert">
            <h2>Não é possível mudar este pedido</h2>
            <p>Você só pode mudar o pedido enquanto ele espera resposta e dentro do prazo.</p>
          </section>
        } @else {
          <form
            sagerUnsaved
            [sagerSaving]="saving"
            class="panel op-panel op-form"
            [formGroup]="form"
            (ngSubmit)="save()"
            novalidate
          >
            <h2>Dados da saída</h2>
            <p>
              {{ resident.residentName }} · Matrícula {{ resident.enrollment }} · Quarto
              {{ resident.roomNumber }}
            </p>
            <p class="op-help">
              Saída curta: até 3 horas a partir da hora em que o supervisor registra sua saída. Vai
              ficar mais tempo? Peça uma saída longa.
            </p>
            <label class="field"
              >Por que você quer sair?<textarea
                rows="3"
                maxlength="2000"
                formControlName="reason"
                required
              ></textarea>
              @if (form.controls.reason.touched && form.controls.reason.invalid) {
                <span class="op-field-error">Escreva o motivo da saída.</span>
              }
            </label>
            <label class="field"
              >Observações (opcional)<textarea
                rows="3"
                maxlength="2000"
                formControlName="notes"
              ></textarea>
            </label>
            @if (error()) {
              <p class="op-error" role="alert">{{ error() }}</p>
            }
            @if (conflict()) {
              <button class="btn op-secondary" type="button" (click)="load()">
                Recarregar dados
              </button>
              <p class="op-help">Recarregar troca o que você digitou pelos dados salvos.</p>
            }
            <div class="op-actions">
              <a routerLink="/saidas" class="btn op-secondary">Cancelar</a
              ><button
                type="submit"
                class="btn op-primary"
                [disabled]="saving() || conflict() === 'stale_version'"
              >
                {{
                  saving() ? 'Enviando pedido…' : editing ? 'Salvar alterações' : 'Enviar pedido'
                }}
              </button>
            </div>
          </form>
        }
      }
    </main>
  `,
})
export class ExitFormLocalComponent {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(OperationsLocalApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly editing = !!this.id;
  readonly eligibility = signal<ExitEligibility | null>(null);
  readonly original = signal<ShortExit | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly conflict = signal<string | null>(null);
  readonly blockerLabel = eligibilityBlocker;
  readonly form = new FormGroup({
    reason: new FormControl('', {
      nonNullable: true,
      validators: [trimmedLength(3, 2000)],
    }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });
  constructor() {
    if (this.session.hasRole('residente')) void this.load();
  }
  async load(): Promise<void> {
    if (!this.session.hasRole('residente') || this.saving()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.conflict.set(null);
    try {
      const [eligibility, original] = await Promise.all([
        this.api.eligibility(),
        this.editing ? this.api.exit(this.id) : Promise.resolve(null),
      ]);
      this.eligibility.set(eligibility);
      this.original.set(original);
      this.form.reset({
        reason: original?.reason ?? '',
        notes: original?.notes ?? '',
      });
    } catch (error) {
      this.loadError.set(operationsError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async save(): Promise<void> {
    const resident = this.eligibility();
    const original = this.original();
    if (
      !this.session.hasRole('residente') ||
      !resident?.eligible ||
      (this.editing && !original?.capabilities.canEdit) ||
      this.saving() ||
      this.conflict() === 'stale_version'
    )
      return;
    this.form.markAllAsTouched();
    this.error.set('');
    this.conflict.set(null);
    if (this.form.invalid) {
      this.error.set('Revise os campos obrigatórios indicados.');
      return;
    }
    const value = this.form.getRawValue();
    // Sempre para agora: o servidor grava a hora do pedido (short-exit-two-steps).
    const input: ShortExitInput = {
      departureMode: 'NOW',
      reason: value.reason.trim(),
      notes: value.notes.trim() || null,
    };
    const error = shortExitFormError(input);
    if (error) {
      this.error.set(error);
      return;
    }
    this.saving.set(true);
    try {
      const fresh = await this.api.eligibility();
      this.eligibility.set(fresh);
      if (!fresh.eligible) {
        this.error.set('Seu cadastro deixou de atender aos requisitos da saída curta.');
        return;
      }
      const exit = await this.api.saveExit(input, original ?? undefined);
      this.saving.set(false);
      this.form.markAsPristine();
      // O pedido novo abre o aviso "Pedido enviado"; a mudança mostra "Pedido salvo.".
      await this.router.navigate(['/saidas', exit.id], {
        queryParams: original ? { saved: '1' } : { enviado: '1' },
      });
    } catch (error) {
      this.error.set(operationsError(error));
      if (
        error instanceof OperationsApiError &&
        error.status === 409 &&
        error.code !== 'overlapping_exit'
      )
        this.conflict.set(error.code ?? 'conflict');
    } finally {
      this.saving.set(false);
    }
  }
}
