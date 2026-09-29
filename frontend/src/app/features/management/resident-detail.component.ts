import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { LegalGuardian } from './management.models';
import { ManagementDemoService } from './management-demo.service';
import { ageFromBirthDate, formattedDate } from './management.utils';
import { ResidentApiError, ResidentApiService, ResidentRecord } from './resident-api.service';

type ResidentTab = 'dados' | 'responsaveis' | 'historico' | 'termos';

@Component({
  selector: 'app-resident-detail',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page">
      @if (!canView()) {
        <section class="mg-empty" role="alert">
          <span class="material-symbols-rounded" aria-hidden="true">lock</span>
          <h1>Acesso restrito</h1>
          <p>Esta área está disponível para gestor e supervisor.</p>
          <a class="btn mg-primary" routerLink="/inicio">Voltar ao início</a>
        </section>
      } @else if (!isDemo()) {
        @if (loading()) {
          <section class="mg-empty" role="status" aria-live="polite">
            <span class="material-symbols-rounded mg-loading-icon" aria-hidden="true"
              >progress_activity</span
            >
            <h1>Carregando residente</h1>
            <p>Consultando o cadastro local de teste.</p>
          </section>
        } @else if (loadError()) {
          <section class="mg-empty" role="alert">
            <h1>
              {{ missing() ? 'Residente não encontrado' : 'Não foi possível carregar o residente' }}
            </h1>
            <p>{{ loadError() }}</p>
            @if (!missing()) {
              <button type="button" class="btn mg-primary" (click)="load()">
                Tentar novamente
              </button>
            }
            <a class="btn mg-secondary" routerLink="/residentes">Voltar aos residentes</a>
          </section>
        } @else if (localResident(); as item) {
          <header class="mg-heading">
            <div>
              <a class="mg-back" routerLink="/residentes"
                ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
                Residentes</a
              >
              <h1>{{ item.name }}</h1>
              <p>Matrícula {{ item.enrollment }}</p>
            </div>
            @if (canEdit()) {
              <a class="btn mg-primary" [routerLink]="['/residentes', item.id, 'editar']"
                ><span class="material-symbols-rounded" aria-hidden="true">edit</span> Editar
                cadastro</a
              >
            }
          </header>
          @if (saved()) {
            <p class="mg-success" role="status">
              <span class="material-symbols-rounded" aria-hidden="true">check_circle</span> Cadastro
              salvo no ambiente local de teste.
            </p>
          }
          <nav class="mg-tabs" aria-label="Seções do residente">
            <button
              type="button"
              [class.active]="tab() === 'dados'"
              [attr.aria-current]="tab() === 'dados' ? 'page' : null"
              (click)="tab.set('dados')"
            >
              Dados
            </button>
            <button
              type="button"
              [class.active]="tab() === 'responsaveis'"
              [attr.aria-current]="tab() === 'responsaveis' ? 'page' : null"
              (click)="tab.set('responsaveis')"
            >
              Responsáveis
            </button>
            <button
              type="button"
              [class.active]="tab() === 'historico'"
              [attr.aria-current]="tab() === 'historico' ? 'page' : null"
              (click)="tab.set('historico')"
            >
              Histórico
            </button>
            <button
              type="button"
              [class.active]="tab() === 'termos'"
              [attr.aria-current]="tab() === 'termos' ? 'page' : null"
              (click)="tab.set('termos')"
            >
              Termos
            </button>
          </nav>
          @if (tab() === 'dados') {
            <section class="panel mg-panel" aria-labelledby="resident-data-heading">
              <h2 id="resident-data-heading">Identificação</h2>
              <dl class="mg-details">
                <div>
                  <dt>Nome completo</dt>
                  <dd>{{ item.name }}</dd>
                </div>
                <div>
                  <dt>Matrícula</dt>
                  <dd>{{ item.enrollment }}</dd>
                </div>
                <div>
                  <dt>Data de nascimento</dt>
                  <dd>{{ item.birthDate ? formattedDate(item.birthDate) : 'Não informado' }}</dd>
                </div>
                <div>
                  <dt>Curso</dt>
                  <dd>{{ item.course || 'Não informado' }}</dd>
                </div>
              </dl>
            </section>
            <div class="mg-note">
              <span class="material-symbols-rounded" aria-hidden="true">info</span>
              <p>
                Quarto e situação ainda não estão integrados a este cadastro. A ausência da data de
                nascimento não indica maioridade.
              </p>
            </div>
            <section class="mg-note mg-sensitive" aria-labelledby="medical-title">
              <span class="material-symbols-rounded" aria-hidden="true">lock</span>
              <div>
                <h2 id="medical-title">Informações médicas restritas</h2>
                <p>
                  Dados sensíveis ainda não estão integrados. O acesso depende das regras
                  profissionais e de definição institucional.
                </p>
              </div>
            </section>
          } @else {
            <section class="panel mg-panel" aria-labelledby="resident-pending-heading">
              <h2 id="resident-pending-heading">
                {{
                  tab() === 'responsaveis'
                    ? 'Responsáveis legais'
                    : tab() === 'historico'
                      ? 'Histórico individual'
                      : 'Termos de Compromisso'
                }}
              </h2>
              <div class="mg-empty mg-empty-inline" role="status">
                <span class="material-symbols-rounded" aria-hidden="true">schedule</span>
                <h3>Ainda não integrado</h3>
                <p>Esta seção depende de definição e integração em outra entrega da Fase 2.</p>
              </div>
            </section>
          }
        } @else {
          <section class="mg-empty" role="alert">
            <h1>Residente não encontrado</h1>
            <p>O cadastro solicitado não está disponível no ambiente local de teste.</p>
            <a class="btn mg-primary" routerLink="/residentes">Voltar aos residentes</a>
          </section>
        }
      } @else if (resident(); as item) {
        <header class="mg-heading">
          <div>
            <a class="mg-back" routerLink="/residentes"
              ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
              Residentes</a
            >
            <h1>{{ item.name }}</h1>
            <p>Matrícula {{ item.enrollment }} · {{ item.course }}</p>
          </div>
          @if (canEdit()) {
            <a class="btn mg-primary" [routerLink]="['/residentes', item.id, 'editar']"
              ><span class="material-symbols-rounded" aria-hidden="true">edit</span> Editar
              cadastro</a
            >
          }
        </header>
        @if (saved()) {
          <p class="mg-success" role="status">
            <span class="material-symbols-rounded" aria-hidden="true">check_circle</span> Cadastro
            salvo nesta demonstração.
          </p>
        }
        <nav class="mg-tabs" aria-label="Seções do residente">
          <button
            type="button"
            [class.active]="tab() === 'dados'"
            [attr.aria-current]="tab() === 'dados' ? 'page' : null"
            (click)="tab.set('dados')"
          >
            Dados
          </button>
          <button
            type="button"
            [class.active]="tab() === 'responsaveis'"
            [attr.aria-current]="tab() === 'responsaveis' ? 'page' : null"
            (click)="tab.set('responsaveis')"
          >
            Responsáveis
          </button>
          <button
            type="button"
            [class.active]="tab() === 'historico'"
            [attr.aria-current]="tab() === 'historico' ? 'page' : null"
            (click)="tab.set('historico')"
          >
            Histórico
          </button>
          <button
            type="button"
            [class.active]="tab() === 'termos'"
            [attr.aria-current]="tab() === 'termos' ? 'page' : null"
            (click)="tab.set('termos')"
          >
            Termos
          </button>
        </nav>

        @if (tab() === 'dados') {
          <section class="panel mg-panel" aria-labelledby="resident-data-heading">
            <h2 id="resident-data-heading">Identificação e residência</h2>
            <dl class="mg-details">
              <div>
                <dt>Nome completo</dt>
                <dd>{{ item.name }}</dd>
              </div>
              <div>
                <dt>Matrícula</dt>
                <dd>{{ item.enrollment }}</dd>
              </div>
              <div>
                <dt>Data de nascimento</dt>
                <dd>{{ formattedDate(item.birthDate) }} · {{ age(item.birthDate) }} anos</dd>
              </div>
              <div>
                <dt>Curso</dt>
                <dd>{{ item.course }}</dd>
              </div>
              <div>
                <dt>Quarto</dt>
                <dd>{{ service.roomLabel(item.roomId) }}</dd>
              </div>
              <div>
                <dt>Situação</dt>
                <dd>
                  <span class="status mg-status">{{ item.status }}</span>
                </dd>
              </div>
            </dl>
          </section>
          <section class="mg-note mg-sensitive" aria-labelledby="medical-title">
            <span class="material-symbols-rounded" aria-hidden="true">lock</span>
            <div>
              <h2 id="medical-title">Informações médicas restritas</h2>
              <p>
                A matriz de acesso a dados médicos ainda depende de definição da AE/TI. Nenhum dado
                médico é exibido ou armazenado nesta demonstração.
              </p>
            </div>
          </section>
        }

        @if (tab() === 'responsaveis') {
          <section class="panel mg-panel" aria-labelledby="guardians-title">
            <div class="mg-section-heading">
              <div>
                <h2 id="guardians-title">Responsáveis legais</h2>
                <p>O contato autorizado é necessário para o fluxo de saída longa.</p>
              </div>
              @if (canEdit() && !editingGuardian()) {
                <button type="button" class="btn mg-primary" (click)="openGuardianForm()">
                  <span class="material-symbols-rounded" aria-hidden="true">person_add</span>
                  Vincular responsável
                </button>
              }
            </div>
            @if (canEdit()) {
              @if (guardians().length) {
                <div class="mg-list">
                  @for (guardian of guardians(); track guardian.id) {
                    <article class="mg-row mg-guardian-row">
                      <div class="mg-avatar" aria-hidden="true">
                        {{ guardian.name.slice(0, 1) }}
                      </div>
                      <div class="mg-row-main">
                        <h3>{{ guardian.name }}</h3>
                        <p>{{ guardian.relationship }} · Telefone {{ guardian.phone }}</p>
                      </div>
                      <div class="mg-row-detail">
                        <strong>{{ guardian.active ? 'Ativo' : 'Inativo' }}</strong
                        ><span>{{
                          guardian.authorized
                            ? 'Autorizado para assinatura'
                            : 'Sem autorização de assinatura'
                        }}</span>
                      </div>
                      <a class="mg-row-link" [routerLink]="['/responsaveis', guardian.id]"
                        >Ver detalhes
                        <span class="material-symbols-rounded" aria-hidden="true"
                          >arrow_forward</span
                        ></a
                      ><button
                        type="button"
                        class="btn mg-secondary"
                        (click)="openGuardianForm(guardian)"
                      >
                        Editar
                      </button>
                    </article>
                  }
                </div>
              } @else {
                <div class="mg-empty mg-empty-inline">
                  <h3>Nenhum responsável vinculado</h3>
                  <p>
                    Vincule um responsável ativo e autorizado antes de solicitar uma saída longa.
                  </p>
                </div>
              }
              @if (editingGuardian()) {
                <form
                  class="mg-inline-form"
                  [formGroup]="guardianForm"
                  (ngSubmit)="saveGuardian()"
                  novalidate
                >
                  <h3>{{ guardianId() ? 'Editar responsável' : 'Novo responsável' }}</h3>
                  <div class="form-grid mg-form-grid">
                    <label class="field mg-field"
                      >Nome completo *<input formControlName="name" autocomplete="name" />
                      @if (
                        guardianForm.controls.name.invalid && guardianForm.controls.name.touched
                      ) {
                        <span class="mg-field-error"
                          >Informe o nome com pelo menos 3 caracteres.</span
                        >
                      }
                    </label>
                    <label class="field mg-field"
                      >Vínculo com o residente *<input
                        formControlName="relationship"
                        placeholder="Ex.: mãe, pai ou tutor"
                      />
                      @if (
                        guardianForm.controls.relationship.invalid &&
                        guardianForm.controls.relationship.touched
                      ) {
                        <span class="mg-field-error">Informe o vínculo com o residente.</span>
                      }
                    </label>
                    <label class="field mg-field"
                      >Telefone para o fluxo de assinatura *<input
                        type="tel"
                        formControlName="phone"
                        inputmode="tel"
                        autocomplete="tel"
                        placeholder="DDD e número, somente dígitos"
                      />
                      @if (
                        guardianForm.controls.phone.invalid && guardianForm.controls.phone.touched
                      ) {
                        <span class="mg-field-error"
                          >Informe 10 ou 11 dígitos, incluindo o DDD.</span
                        >
                      }
                    </label>
                  </div>
                  <label class="mg-check"
                    ><input type="checkbox" formControlName="active" /> Responsável ativo</label
                  >
                  <label class="mg-check"
                    ><input type="checkbox" formControlName="authorized" /> Autorizado para
                    assinatura de saída longa</label
                  >
                  <p class="mg-muted">Nenhuma mensagem será enviada nesta demonstração.</p>
                  @if (guardianError()) {
                    <p role="alert" class="mg-alert">{{ guardianError() }}</p>
                  }
                  <div class="action-row mg-actions">
                    <button type="button" class="btn mg-secondary" (click)="closeGuardianForm()">
                      Cancelar</button
                    ><button type="submit" class="btn mg-primary">Salvar responsável</button>
                  </div>
                </form>
              }
            } @else {
              <div class="mg-note">
                <span class="material-symbols-rounded" aria-hidden="true">lock</span>
                <p>
                  Contatos e autorizações dos responsáveis ficam disponíveis apenas ao gestor nesta
                  demonstração. A permissão operacional do supervisor depende de definição da AE/TI.
                </p>
              </div>
            }
          </section>
        }

        @if (tab() === 'historico') {
          <section class="panel mg-panel" aria-labelledby="history-title">
            <h2 id="history-title">Histórico individual</h2>
            <p class="mg-muted">
              Eventos abaixo são exemplos fictícios. Registros reais serão fornecidos pelos módulos
              operacionais.
            </p>
            @if (history().length) {
              <ol class="mg-timeline">
                @for (entry of history(); track entry.id) {
                  <li>
                    <time>{{ formattedDate(entry.date) }}</time>
                    <div>
                      <strong>{{ entry.category }}</strong>
                      <p>{{ entry.description }}</p>
                    </div>
                  </li>
                }
              </ol>
            } @else {
              <div class="mg-empty mg-empty-inline">
                <h3>Sem eventos demonstrativos</h3>
                <p>O histórico aparecerá aqui quando existirem registros da operação.</p>
              </div>
            }
          </section>
        }

        @if (tab() === 'termos') {
          <section class="panel mg-panel" aria-labelledby="terms-title">
            <h2 id="terms-title">Termos de Compromisso</h2>
            <div class="mg-empty mg-empty-inline">
              <span class="material-symbols-rounded" aria-hidden="true">description</span>
              <h3>Nenhum termo disponível</h3>
              <p>
                Critérios de emissão, ciência e assinatura do Termo de Compromisso dependem de
                homologação pela AE. Nenhum documento é gerado nesta demonstração.
              </p>
            </div>
          </section>
        }
      } @else {
        <section class="mg-empty" role="alert">
          <h1>Residente não encontrado</h1>
          <p>O cadastro solicitado não está disponível nesta demonstração.</p>
          <a class="btn mg-primary" routerLink="/residentes">Voltar aos residentes</a>
        </section>
      }
    </main>
  `,
})
export class ResidentDetailComponent {
  readonly service = inject(ManagementDemoService);
  private readonly api = inject(ResidentApiService);
  private readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly isDemo = this.session.active;
  readonly canView = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly canEdit = computed(() => this.session.hasRole('gestor'));
  readonly resident = computed(() => this.service.resident(this.id));
  readonly localResident = signal<ResidentRecord | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly missing = signal(false);
  readonly guardians = computed(() => this.service.guardiansFor(this.id));
  readonly history = computed(() =>
    this.service.history().filter((entry) => entry.residentId === this.id),
  );
  readonly tab = signal<ResidentTab>('dados');
  readonly saved = signal(this.route.snapshot.queryParamMap.get('saved') === '1');
  readonly editingGuardian = signal(false);
  readonly guardianId = signal<string | null>(null);
  readonly guardianError = signal('');
  readonly guardianForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    relationship: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{10,11}$/)],
    }),
    active: new FormControl(true, { nonNullable: true }),
    authorized: new FormControl(true, { nonNullable: true }),
  });
  readonly age = ageFromBirthDate;
  readonly formattedDate = formattedDate;

  constructor() {
    if (!this.isDemo() && this.canView()) void this.load();
  }

  async load(): Promise<void> {
    if (this.isDemo() || !this.canView()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.missing.set(false);
    try {
      this.localResident.set(await this.api.get(this.id));
    } catch (error) {
      this.localResident.set(null);
      this.missing.set(error instanceof ResidentApiError && error.status === 404);
      this.loadError.set(
        this.missing()
          ? 'O cadastro solicitado não está disponível no ambiente local de teste.'
          : 'Confira a conexão com o backend local e tente novamente.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  openGuardianForm(guardian?: LegalGuardian): void {
    if (!this.canEdit()) return;
    this.guardianError.set('');
    this.guardianId.set(guardian?.id ?? null);
    this.guardianForm.setValue({
      name: guardian?.name ?? '',
      relationship: guardian?.relationship ?? '',
      phone: guardian?.phone ?? '',
      active: guardian?.active ?? true,
      authorized: guardian?.authorized ?? true,
    });
    this.editingGuardian.set(true);
  }

  closeGuardianForm(): void {
    this.editingGuardian.set(false);
    this.guardianId.set(null);
    this.guardianError.set('');
  }

  saveGuardian(): void {
    if (!this.canEdit()) return;
    this.guardianError.set('');
    if (this.guardianForm.invalid) {
      this.guardianForm.markAllAsTouched();
      return;
    }
    try {
      this.service.saveGuardian(
        this.id,
        this.guardianForm.getRawValue(),
        this.guardianId() ?? undefined,
      );
      this.closeGuardianForm();
    } catch (error) {
      this.guardianError.set(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o responsável. Tente novamente.',
      );
    }
  }
}
