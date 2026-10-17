import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { UnsavedFormDirective } from '../../shared/unsaved-form';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DemoSessionService } from '../../core/demo-session.service';
import { ResidentApiService, ResidentRecord } from '../management/resident-api.service';
import { HealthApiService, healthErrorMessage } from './health-api.service';
import {
  CareAssignment,
  HealthAccount,
  HealthCustody,
  HealthProfession,
  ProfessionalGrant,
  professionLabels,
} from './health.models';
import { trimmedLength } from './health.helpers';

type EndAction = {
  kind: 'grant' | 'assignment' | 'custody';
  id: string;
  version: number;
  label: string;
};

@Component({
  selector: 'app-health-access',
  imports: [
    SearchableSelectDirective,
    UnsavedFormDirective,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './health.scss',
  template: `
    <main class="page health-page">
      <header class="page-header health-heading">
        <div>
          <h1>Acessos de saúde</h1>
          <p>Confira habilitações profissionais, vínculos assistenciais e custódias.</p>
        </div>
        @if (professionalAccess()) {
          <a class="btn-secondary" routerLink="/saude">Área assistencial</a>
        }
      </header>
      @if (loading()) {
        <p role="status">Carregando acessos…</p>
      }
      @if (error()) {
        <p class="health-alert" role="alert">{{ error() }}</p>
        <button type="button" class="btn-secondary" (click)="load()" [disabled]="loading()">
          Tentar novamente
        </button>
      }
      @if (success()) {
        <p class="health-success" role="status">{{ success() }}</p>
      }
      @if (allowed()) {
        <section class="panel health-section" aria-labelledby="grant-title">
          <h2 id="grant-title">Habilitações profissionais</h2>
          <p>
            A administração confere os metadados de acesso. O papel de gestão não libera conteúdo
            assistencial.
          </p>
          <form class="health-filter" (submit)="$event.preventDefault(); searchAccounts()">
            <div class="field">
              <label for="account-search">Buscar conta por nome ou e-mail</label
              ><input
                id="account-search"
                [formControl]="accountQuery"
                type="search"
                maxlength="200"
              />
            </div>
            <button type="submit" class="btn" [disabled]="busy()">Buscar contas</button>
          </form>
          <div class="field health-section">
            <label for="grant-account">Conta a habilitar *</label>
            <select
              sagerSearchable
              id="grant-account"
              [formControl]="grantForm.controls.accountId"
              (change)="loadGrants()"
              [attr.aria-invalid]="invalid(grantForm, 'accountId')"
              aria-describedby="grant-account-help"
            >
              <option value="">Selecione uma conta</option>
              @for (account of accounts(); track account.id) {
                <option [value]="account.id">
                  {{ account.name }} ·
                  {{ account.matricula || account.email || 'Sem matrícula atribuída' }}
                </option>
              }</select
            ><span
              id="grant-account-help"
              class="field-hint"
              [class.field-error]="invalid(grantForm, 'accountId')"
              >Selecione uma conta ativa. O perfil de acesso permanece o mesmo.</span
            >
          </div>
          @if (accounts().length === 0) {
            <p class="health-meta">Nenhuma conta encontrada. Ajuste a busca.</p>
          }
          @if (accountCursor() !== null) {
            <button
              type="button"
              class="btn-secondary health-pagination"
              [disabled]="busy()"
              (click)="searchAccounts(true)"
            >
              Carregar mais contas
            </button>
          }
          <details class="health-disclosure">
            <summary>Conferir e habilitar profissional</summary>
            <form
              sagerUnsaved
              [sagerSaving]="busy"
              class="health-form"
              [formGroup]="grantForm"
              (ngSubmit)="createGrant()"
            >
              <div class="form-grid">
                <div class="field">
                  <label for="grant-profession">Profissão *</label
                  ><select sagerSearchable id="grant-profession" formControlName="profession">
                    <option value="MEDICINA">Medicina</option>
                    <option value="ENFERMAGEM">Enfermagem</option>
                    <option value="PSICOLOGIA">Psicologia</option>
                  </select>
                </div>
                <div class="field">
                  <label for="grant-number">Número do registro profissional *</label
                  ><input
                    id="grant-number"
                    formControlName="registrationNumber"
                    maxlength="100"
                    aria-describedby="grant-number-help"
                    [attr.aria-invalid]="invalid(grantForm, 'registrationNumber')"
                  /><span
                    id="grant-number-help"
                    class="field-hint"
                    [class.field-error]="invalid(grantForm, 'registrationNumber')"
                    >Informe o registro conferido, com até 100 caracteres.</span
                  >
                </div>
                <div class="field">
                  <label for="grant-region">UF do registro *</label
                  ><input
                    id="grant-region"
                    formControlName="registrationRegion"
                    maxlength="2"
                    aria-describedby="grant-region-help"
                    [attr.aria-invalid]="invalid(grantForm, 'registrationRegion')"
                  /><span
                    id="grant-region-help"
                    class="field-hint"
                    [class.field-error]="invalid(grantForm, 'registrationRegion')"
                    >Use a sigla com duas letras, por exemplo GO.</span
                  >
                </div>
                <div class="field span-2">
                  <label for="grant-reason">Justificativa da verificação *</label
                  ><textarea
                    id="grant-reason"
                    formControlName="verificationReason"
                    maxlength="500"
                    aria-describedby="grant-reason-help"
                    [attr.aria-invalid]="invalid(grantForm, 'verificationReason')"
                  ></textarea
                  ><span
                    id="grant-reason-help"
                    class="field-hint"
                    [class.field-error]="invalid(grantForm, 'verificationReason')"
                    >De 10 a 500 caracteres, sem conteúdo clínico.</span
                  >
                </div>
              </div>
              <div class="action-row">
                <button class="btn" type="submit" [disabled]="busy()">
                  Habilitar profissional
                </button>
              </div>
            </form>
          </details>
          @if (grantForm.controls.accountId.value) {
            <h3 class="health-section">Histórico da conta selecionada</h3>
            <ul class="health-list">
              @for (grant of grants(); track grant.id) {
                <li class="health-row">
                  <div>
                    <h3>
                      {{ professions[grant.profession] }} · {{ grant.registrationNumber }}/{{
                        grant.registrationRegion
                      }}
                    </h3>
                    <p>{{ grant.endedAt ? 'Habilitação revogada' : 'Habilitação vigente' }}</p>
                    <p class="health-meta">
                      Conferida em {{ grant.verifiedAt | date: 'dd/MM/yyyy HH:mm' }} ·
                      {{ grant.verificationReason }}
                    </p>
                  </div>
                  @if (!grant.endedAt) {
                    <button
                      type="button"
                      class="btn-secondary"
                      [disabled]="busy()"
                      (click)="prepareEnd('grant', grant, grant.accountName)"
                    >
                      Revogar habilitação
                    </button>
                  }
                </li>
              } @empty {
                <li class="health-state">Nenhuma habilitação registrada para esta conta.</li>
              }
            </ul>
            @if (grantCursor() !== null) {
              <button
                type="button"
                class="btn-secondary health-pagination"
                [disabled]="busy()"
                (click)="loadGrants(true)"
              >
                Carregar habilitações anteriores
              </button>
            }
          }
        </section>
        <section class="panel health-section" aria-labelledby="assignment-title">
          <h2 id="assignment-title">Vínculos assistenciais</h2>
          <div class="field">
            <label for="care-resident">Residente *</label
            ><select
              sagerSearchable
              id="care-resident"
              [formControl]="residentId"
              (change)="loadResidentAccess()"
              aria-describedby="care-resident-help"
              [attr.aria-invalid]="residentId.touched && residentId.invalid"
            >
              <option value="">Selecione um residente</option>
              @for (resident of residents(); track resident.id) {
                <option [value]="resident.id">
                  {{ resident.name }} · {{ resident.enrollment }}
                </option>
              }</select
            ><span
              id="care-resident-help"
              class="field-hint"
              [class.field-error]="residentId.touched && residentId.invalid"
              >Selecione o cadastro a vincular.</span
            >
          </div>
          <form
            sagerUnsaved
            [sagerSaving]="busy"
            class="health-form"
            [formGroup]="assignmentForm"
            (ngSubmit)="createAssignment()"
          >
            <div class="form-grid">
              <div class="field">
                <label for="care-grant">Habilitação vigente *</label
                ><select
                  sagerSearchable
                  id="care-grant"
                  formControlName="professionalGrantId"
                  aria-describedby="care-grant-help"
                  [attr.aria-invalid]="invalid(assignmentForm, 'professionalGrantId')"
                >
                  <option value="">Selecione uma habilitação</option>
                  @for (grant of activeGrants(); track grant.id) {
                    <option [value]="grant.id">
                      {{ grant.accountName }} · {{ professions[grant.profession] }}
                    </option>
                  }</select
                ><span
                  id="care-grant-help"
                  class="field-hint"
                  [class.field-error]="invalid(assignmentForm, 'professionalGrantId')"
                  >Use a conta selecionada na seção de habilitações.</span
                >
              </div>
              <div class="field span-2">
                <label for="care-reason">Justificativa do vínculo *</label
                ><textarea
                  id="care-reason"
                  formControlName="reason"
                  maxlength="500"
                  aria-describedby="care-reason-help"
                  [attr.aria-invalid]="invalid(assignmentForm, 'reason')"
                ></textarea
                ><span
                  id="care-reason-help"
                  class="field-hint"
                  [class.field-error]="invalid(assignmentForm, 'reason')"
                  >De 10 a 500 caracteres, sem conteúdo clínico.</span
                >
              </div>
            </div>
            <div class="action-row">
              <button type="submit" class="btn" [disabled]="busy()">
                Criar vínculo assistencial
              </button>
            </div>
          </form>
          @if (residentId.value) {
            <h3 class="health-section">Histórico de vínculos do residente</h3>
            <ul class="health-list">
              @for (assignment of assignments(); track assignment.id) {
                <li class="health-row">
                  <div>
                    <h3>{{ assignment.accountName }} · {{ professions[assignment.profession] }}</h3>
                    <p>{{ assignment.endedAt ? 'Vínculo encerrado' : 'Vínculo vigente' }}</p>
                    <p class="health-meta">
                      {{ assignment.startedAt | date: 'dd/MM/yyyy HH:mm' }} ·
                      {{ assignment.reason }}
                    </p>
                  </div>
                  @if (!assignment.endedAt) {
                    <button
                      type="button"
                      class="btn-secondary"
                      [disabled]="busy()"
                      (click)="prepareEnd('assignment', assignment, assignment.accountName)"
                    >
                      Encerrar vínculo
                    </button>
                  }
                </li>
              } @empty {
                <li class="health-state">Nenhum vínculo registrado para este residente.</li>
              }
            </ul>
            @if (assignmentCursor() !== null) {
              <button
                type="button"
                class="btn-secondary health-pagination"
                [disabled]="busy()"
                (click)="moreAssignments()"
              >
                Carregar vínculos anteriores
              </button>
            }
          }
        </section>
        <section class="panel health-section" aria-labelledby="custody-title">
          <h2 id="custody-title">Custódia de registros</h2>
          <p>
            Transfira o acesso ao conjunto do residente selecionado e do autor que perdeu acesso. O
            destinatário precisa de profissão compatível e vínculo vigente.
          </p>
          <form
            sagerUnsaved
            [sagerSaving]="busy"
            class="health-form"
            [formGroup]="custodyForm"
            (ngSubmit)="createCustody()"
          >
            <div class="form-grid">
              <div class="field">
                <label for="custody-source">UUID da conta do autor desligado *</label
                ><input
                  id="custody-source"
                  formControlName="sourceAuthorAccountId"
                  aria-describedby="custody-source-help"
                  [attr.aria-invalid]="invalid(custodyForm, 'sourceAuthorAccountId')"
                /><span
                  id="custody-source-help"
                  class="field-hint"
                  [class.field-error]="invalid(custodyForm, 'sourceAuthorAccountId')"
                  >Informe o UUID completo da conta de origem.</span
                >
              </div>
              <div class="field">
                <label for="custody-recipient">Habilitação do custodiante *</label
                ><select
                  sagerSearchable
                  id="custody-recipient"
                  formControlName="recipientGrantId"
                  aria-describedby="custody-recipient-help"
                  [attr.aria-invalid]="invalid(custodyForm, 'recipientGrantId')"
                >
                  <option value="">Selecione uma habilitação</option>
                  @for (grant of activeGrants(); track grant.id) {
                    <option [value]="grant.id">
                      {{ grant.accountName }} · {{ professions[grant.profession] }}
                    </option>
                  }</select
                ><span
                  id="custody-recipient-help"
                  class="field-hint"
                  [class.field-error]="invalid(custodyForm, 'recipientGrantId')"
                  >Selecione uma habilitação da conta escolhida acima.</span
                >
              </div>
              <div class="field span-2">
                <label for="custody-reason">Justificativa da custódia *</label
                ><textarea
                  id="custody-reason"
                  formControlName="reason"
                  maxlength="500"
                  aria-describedby="custody-reason-help"
                  [attr.aria-invalid]="invalid(custodyForm, 'reason')"
                ></textarea
                ><span
                  id="custody-reason-help"
                  class="field-hint"
                  [class.field-error]="invalid(custodyForm, 'reason')"
                  >De 10 a 500 caracteres, sem conteúdo clínico.</span
                >
              </div>
            </div>
            <div class="action-row">
              <button type="submit" class="btn" [disabled]="busy()">Autorizar custódia</button>
            </div>
          </form>
          @if (residentId.value) {
            <h3 class="health-section">Custódias do residente</h3>
            <ul class="health-list">
              @for (custody of custodies(); track custody.id) {
                <li class="health-row">
                  <div>
                    <h3>{{ custody.recipientAccountName }}</h3>
                    <p>{{ custody.endedAt ? 'Custódia encerrada' : 'Custódia vigente' }}</p>
                    <p class="health-meta">Autor de origem: {{ custody.sourceAuthorAccountId }}</p>
                    <p class="health-meta">
                      {{ custody.createdAt | date: 'dd/MM/yyyy HH:mm' }} · {{ custody.reason }}
                    </p>
                  </div>
                  @if (!custody.endedAt) {
                    <button
                      type="button"
                      class="btn-secondary"
                      [disabled]="busy()"
                      (click)="prepareEnd('custody', custody, custody.recipientAccountName)"
                    >
                      Encerrar custódia
                    </button>
                  }
                </li>
              } @empty {
                <li class="health-state">Nenhuma custódia registrada para este residente.</li>
              }
            </ul>
            @if (custodyCursor() !== null) {
              <button
                type="button"
                class="btn-secondary health-pagination"
                [disabled]="busy()"
                (click)="moreCustodies()"
              >
                Carregar custódias anteriores
              </button>
            }
          }
        </section>
        @if (pendingEnd(); as target) {
          <section class="panel health-section" aria-labelledby="health-end-title">
            <h2 id="health-end-title">Confirmar encerramento</h2>
            <p>
              Encerrar o acesso de <strong>{{ target.label }}</strong
              >? O histórico permanece preservado; o acesso correspondente será bloqueado.
            </p>
            <form
              sagerUnsaved
              [sagerSaving]="busy"
              class="health-form"
              [formGroup]="endForm"
              (ngSubmit)="confirmEnd()"
            >
              <div class="field">
                <label for="access-end-reason">Justificativa do encerramento *</label
                ><textarea
                  id="access-end-reason"
                  formControlName="reason"
                  maxlength="500"
                  aria-describedby="access-end-help"
                  [attr.aria-invalid]="invalid(endForm, 'reason')"
                ></textarea
                ><span
                  id="access-end-help"
                  class="field-hint"
                  [class.field-error]="invalid(endForm, 'reason')"
                  >De 10 a 500 caracteres, sem conteúdo clínico.</span
                >
              </div>
              <div class="action-row">
                <button type="submit" class="btn" [disabled]="busy()">Confirmar encerramento</button
                ><button
                  type="button"
                  class="btn-secondary"
                  [disabled]="busy()"
                  (click)="pendingEnd.set(null)"
                >
                  Cancelar encerramento
                </button>
              </div>
            </form>
          </section>
        }
      }
    </main>
  `,
})
export class HealthAccessPage {
  private readonly api = inject(HealthApiService);
  private readonly residentApi = inject(ResidentApiService);
  private readonly session = inject(DemoSessionService);
  private readonly destroy = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly allowed = signal(false);
  readonly professionalAccess = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly accounts = signal<HealthAccount[]>([]);
  readonly grants = signal<ProfessionalGrant[]>([]);
  readonly residents = signal<ResidentRecord[]>([]);
  readonly assignments = signal<CareAssignment[]>([]);
  readonly custodies = signal<HealthCustody[]>([]);
  readonly accountCursor = signal<string | number | null>(null);
  readonly grantCursor = signal<string | number | null>(null);
  readonly assignmentCursor = signal<string | number | null>(null);
  readonly custodyCursor = signal<string | number | null>(null);
  readonly pendingEnd = signal<EndAction | null>(null);
  readonly activeGrants = computed(() => this.grants().filter((g) => !g.endedAt));
  readonly professions = professionLabels;
  readonly accountQuery = new FormControl('', { nonNullable: true });
  readonly residentId = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly grantForm = new FormGroup({
    accountId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    profession: new FormControl<HealthProfession>('MEDICINA', { nonNullable: true }),
    registrationNumber: new FormControl('', {
      nonNullable: true,
      validators: [trimmedLength(1, 100)],
    }),
    registrationRegion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^[a-zA-Z]{2}$/)],
    }),
    verificationReason: new FormControl('', {
      nonNullable: true,
      validators: [trimmedLength(10, 500)],
    }),
  });
  readonly assignmentForm = new FormGroup({
    professionalGrantId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    reason: new FormControl('', { nonNullable: true, validators: [trimmedLength(10, 500)] }),
  });
  readonly custodyForm = new FormGroup({
    sourceAuthorAccountId: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
      ],
    }),
    recipientGrantId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl('', { nonNullable: true, validators: [trimmedLength(10, 500)] }),
  });
  readonly endForm = new FormGroup({
    reason: new FormControl('', { nonNullable: true, validators: [trimmedLength(10, 500)] }),
  });
  private grantRequest = 0;
  private accessRequest = 0;
  constructor() {
    void this.load();
  }

  invalid(form: FormGroup, name: string): boolean {
    const control = form.get(name);
    return !!control?.touched && !!control.invalid;
  }
  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.allowed.set(false);
    this.pendingEnd.set(null);
    this.endForm.reset();
    try {
      if (this.session.active()) throw new Error('A área de saúde requer uma conta local.');
      const me = await firstValueFrom(this.api.getMe());
      this.professionalAccess.set(!!me.professionalGrant);
      if (!me.canAdministerAccess) {
        this.error.set('Sua conta não pode administrar acessos de saúde.');
        return;
      }
      const [accounts, residents] = await Promise.all([
        this.api.accounts(),
        this.residentApi.list(),
      ]);
      if (this.destroy.destroyed) return;
      this.accounts.set(accounts.items);
      this.accountCursor.set(accounts.nextCursor);
      this.residents.set(residents);
      this.allowed.set(true);
      if (this.grantForm.controls.accountId.value) await this.loadGrants();
      if (this.residentId.value) await this.loadResidentAccess();
    } catch (error) {
      if (!this.destroy.destroyed) this.error.set(healthErrorMessage(error));
    } finally {
      if (!this.destroy.destroyed) this.loading.set(false);
    }
  }
  async searchAccounts(more = false): Promise<void> {
    if (!this.allowed() || this.busy()) return;
    await this.run(async () => {
      const page = await this.api.accounts(
        this.accountQuery.value.trim(),
        more ? this.accountCursor() : undefined,
      );
      if (this.destroy.destroyed) return;
      this.accounts.update((items) => (more ? [...items, ...page.items] : page.items));
      this.accountCursor.set(page.nextCursor);
    });
  }
  async loadGrants(more = false): Promise<void> {
    const request = ++this.grantRequest;
    const id = this.grantForm.controls.accountId.value;
    if (!more) {
      this.grants.set([]);
      this.grantCursor.set(null);
      this.assignmentForm.controls.professionalGrantId.reset();
      this.custodyForm.controls.recipientGrantId.reset();
    }
    if (!id) return;
    try {
      const page = await this.api.grants(id, more ? this.grantCursor() : undefined);
      if (
        this.destroy.destroyed ||
        request !== this.grantRequest ||
        id !== this.grantForm.controls.accountId.value
      )
        return;
      this.grants.update((items) => (more ? [...items, ...page.items] : page.items));
      this.grantCursor.set(page.nextCursor);
    } catch (error) {
      if (!this.destroy.destroyed && request === this.grantRequest)
        this.error.set(healthErrorMessage(error));
    }
  }
  async loadResidentAccess(): Promise<void> {
    const request = ++this.accessRequest;
    const id = this.residentId.value;
    this.assignments.set([]);
    this.custodies.set([]);
    this.assignmentCursor.set(null);
    this.custodyCursor.set(null);
    if (!id) return;
    try {
      const [assignments, custodies] = await Promise.all([
        this.api.assignments(id),
        this.api.custodies(id),
      ]);
      if (this.destroy.destroyed || request !== this.accessRequest || id !== this.residentId.value)
        return;
      this.assignments.set(assignments.items);
      this.assignmentCursor.set(assignments.nextCursor);
      this.custodies.set(custodies.items);
      this.custodyCursor.set(custodies.nextCursor);
    } catch (error) {
      if (!this.destroy.destroyed && request === this.accessRequest)
        this.error.set(healthErrorMessage(error));
    }
  }
  async moreAssignments(): Promise<void> {
    const request = this.accessRequest;
    await this.run(async () => {
      const page = await this.api.assignments(this.residentId.value, this.assignmentCursor());
      if (!this.destroy.destroyed && request === this.accessRequest) {
        this.assignments.update((items) => [...items, ...page.items]);
        this.assignmentCursor.set(page.nextCursor);
      }
    });
  }
  async moreCustodies(): Promise<void> {
    const request = this.accessRequest;
    await this.run(async () => {
      const page = await this.api.custodies(this.residentId.value, this.custodyCursor());
      if (!this.destroy.destroyed && request === this.accessRequest) {
        this.custodies.update((items) => [...items, ...page.items]);
        this.custodyCursor.set(page.nextCursor);
      }
    });
  }
  async createGrant(): Promise<void> {
    if (!this.validate(this.grantForm)) return;
    const v = this.grantForm.getRawValue();
    await this.run(async () => {
      await this.api.createGrant({
        ...v,
        registrationNumber: v.registrationNumber.trim(),
        registrationRegion: v.registrationRegion.trim().toUpperCase(),
        verificationReason: v.verificationReason.trim(),
      });
      this.grantForm.markAsPristine();
      await this.loadGrants();
    }, 'Habilitação registrada.');
  }
  async createAssignment(): Promise<void> {
    this.residentId.markAsTouched();
    if (!this.validate(this.assignmentForm) || this.residentId.invalid) {
      this.focusInvalid();
      return;
    }
    const value = this.assignmentForm.getRawValue();
    await this.run(async () => {
      await this.api.createAssignment({
        ...value,
        residentId: this.residentId.value,
        reason: value.reason.trim(),
      });
      this.assignmentForm.controls.reason.reset();
      this.assignmentForm.markAsPristine();
      await this.loadResidentAccess();
    }, 'Vínculo assistencial registrado.');
  }
  async createCustody(): Promise<void> {
    this.residentId.markAsTouched();
    if (!this.validate(this.custodyForm) || this.residentId.invalid) {
      this.focusInvalid();
      return;
    }
    const value = this.custodyForm.getRawValue();
    await this.run(async () => {
      await this.api.createCustody({
        ...value,
        residentId: this.residentId.value,
        sourceAuthorAccountId: value.sourceAuthorAccountId.trim(),
        reason: value.reason.trim(),
      });
      await this.loadResidentAccess();
      this.custodyForm.reset();
    }, 'Custódia registrada.');
  }
  prepareEnd(kind: EndAction['kind'], item: { id: string; version: number }, label: string): void {
    this.pendingEnd.set({ kind, ...item, label });
    this.endForm.reset();
    setTimeout(
      () => this.element.nativeElement.querySelector<HTMLElement>('#access-end-reason')?.focus(),
      0,
    );
  }
  async confirmEnd(): Promise<void> {
    const target = this.pendingEnd();
    if (!target || !this.validate(this.endForm)) return;
    const reason = this.endForm.controls.reason.value.trim();
    await this.run(async () => {
      if (target.kind === 'grant') await this.api.revokeGrant(target.id, target.version, reason);
      else if (target.kind === 'assignment')
        await this.api.endAssignment(target.id, target.version, reason);
      else await this.api.endCustody(target.id, target.version, reason);
      this.pendingEnd.set(null);
      await Promise.all([this.loadGrants(), this.loadResidentAccess()]);
    }, 'Acesso encerrado. O histórico foi preservado.');
  }
  private validate(form: FormGroup): boolean {
    if (!this.allowed() || this.busy()) return false;
    if (form.valid) return true;
    form.markAllAsTouched();
    this.focusInvalid();
    return false;
  }
  private focusInvalid(): void {
    setTimeout(
      () => this.element.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      0,
    );
  }
  private async run(action: () => Promise<void>, message = ''): Promise<void> {
    if (!this.allowed() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await action();
      if (!this.destroy.destroyed && !this.error()) this.success.set(message);
    } catch (error) {
      if (!this.destroy.destroyed) this.error.set(healthErrorMessage(error));
    } finally {
      if (!this.destroy.destroyed) this.busy.set(false);
    }
  }
}
