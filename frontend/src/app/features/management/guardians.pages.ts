import { debounceTime, merge } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { PaginationComponent } from '../../shared/pagination.component';
import { normalizeSearch } from '../../shared/search';
import { rememberFilters, rememberValue } from '../../core/filter-state';
import { UnsavedFormDirective } from '../../shared/unsaved-form';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { GuardianApiError, GuardianApiService, GuardianRecord } from './guardian-api.service';
import { ManagementDemoService } from './management-demo.service';
import { ResidentApiService, ResidentRecord } from './resident-api.service';

function trimmedLength(min: number, max: number) {
  return (control: AbstractControl): { trimmedLength: true } | null => {
    const length = String(control.value ?? '').trim().length;
    return length < min || length > max ? { trimmedLength: true } : null;
  };
}

@Component({
  selector: 'app-guardians',
  standalone: true,
  imports: [SearchableSelectDirective, PaginationComponent, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page">
      <header class="mg-heading">
        <div>
          <a class="mg-back" routerLink="/residentes"
            ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
            Residentes</a
          >
          <h1>Responsáveis legais</h1>
          <p>
            {{
              isDemo()
                ? 'Consulte os vínculos e autorizações demonstrativas.'
                : 'Consulte os vínculos cadastrados no ambiente local de teste.'
            }}
          </p>
        </div>
        @if (canEdit()) {
          <a class="btn mg-primary" routerLink="/responsaveis/novo"
            ><span class="material-symbols-rounded" aria-hidden="true">person_add</span> Cadastrar
            responsável</a
          >
        }
      </header>
      <section class="panel mg-panel" aria-labelledby="guardian-search-title">
        <h2 id="guardian-search-title">Buscar responsáveis</h2>
        <label class="field mg-field"
          >Nome do responsável ou residente
          <input
            type="search"
            [formControl]="search"
            placeholder="Digite um nome"
            autocomplete="off"
          /> </label
        ><label class="field mg-field"
          >Situação<select sagerSearchable [formControl]="activeFilter">
            <option value="">Todas</option>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select></label
        >
        <label class="field mg-field"
          >Residente vinculado<select sagerSearchable [formControl]="residentFilter">
            <option value="">Todos</option>
            @for (resident of isDemo() ? service.residents() : residents(); track resident.id) {
              <option [value]="resident.id">{{ resident.name }} · {{ resident.enrollment }}</option>
            }
          </select></label
        >
        <button
          type="button"
          class="btn mg-secondary"
          (click)="search.setValue(''); activeFilter.setValue(''); residentFilter.setValue('')"
        >
          Limpar filtros
        </button>
      </section>
      <section class="mg-section" aria-labelledby="guardian-results-title">
        <div class="mg-section-heading">
          <h2 id="guardian-results-title">Responsáveis cadastrados</h2>
          <p aria-live="polite">
            {{
              isDemo() && scenario() !== 'padrao' ? 'Cenário demonstrativo' : total() + ' registros'
            }}
          </p>
        </div>
        @if ((!isDemo() && loading()) || (isDemo() && scenario() === 'carregando')) {
          <div class="mg-empty" role="status">
            <span class="material-symbols-rounded mg-loading-icon" aria-hidden="true"
              >progress_activity</span
            >
            <h3>Carregando responsáveis</h3>
            <p>
              {{
                isDemo()
                  ? 'Estado simulado para avaliar a interface.'
                  : 'Consultando o cadastro local de teste.'
              }}
            </p>
            @if (isDemo()) {
              <button class="btn mg-secondary" type="button" (click)="retry()">
                Voltar ao cenário padrão
              </button>
            }
          </div>
        } @else if ((!isDemo() && loadError()) || (isDemo() && scenario() === 'erro')) {
          <div class="mg-empty" role="alert">
            <h3>Não foi possível carregar responsáveis</h3>
            <p>
              {{
                isDemo()
                  ? 'Falha simulada. Tente novamente para ver os registros fictícios.'
                  : 'Confira a conexão com o backend local e tente novamente.'
              }}
            </p>
            <button class="btn mg-primary" type="button" (click)="retry()">Tentar novamente</button>
          </div>
        } @else if (
          (isDemo() && scenario() === 'vazio') || (!filtered().length && !query().trim())
        ) {
          <div class="mg-empty" role="status">
            <h3>Nenhum responsável cadastrado</h3>
            <p>
              {{
                isDemo()
                  ? 'Estado vazio da demonstração.'
                  : 'Cadastre um responsável para criar o primeiro vínculo.'
              }}
            </p>
            @if (isDemo() && scenario() === 'vazio') {
              <button class="btn mg-secondary" type="button" (click)="retry()">
                Voltar ao cenário padrão
              </button>
            }
          </div>
        } @else if (filtered().length) {
          <div class="mg-list">
            @for (item of paged(); track item.id) {
              <article class="mg-row">
                <div class="mg-avatar" aria-hidden="true">{{ item.name.slice(0, 1) }}</div>
                <div class="mg-row-main">
                  <h3>{{ item.name }}</h3>
                  <p>{{ item.relationship }} de {{ residentName(item.residentId) }}</p>
                </div>
                <div class="mg-row-detail">
                  <strong>{{ item.active ? 'Ativo' : 'Inativo' }}</strong
                  ><span>{{
                    isDemo()
                      ? demoAuthorization(item.id)
                      : 'Assinatura pendente de definição institucional'
                  }}</span>
                </div>
                <a class="mg-row-link" [routerLink]="['/responsaveis', item.id]"
                  >Ver detalhes
                  <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></a
                >
              </article>
            }
          </div>
        } @else {
          <div class="mg-empty" role="status">
            <h3>Nenhum responsável encontrado</h3>
            <p>Confira a busca ou limpe o campo.</p>
            <button class="btn mg-secondary" type="button" (click)="search.setValue('')">
              Limpar busca
            </button>
          </div>
        }
        <sager-pagination [page]="page()" [total]="total()" (pageChange)="changePage($event)" />
      </section>
      <div class="mg-note">
        <span class="material-symbols-rounded" aria-hidden="true">info</span>
        <p>
          {{
            isDemo()
              ? 'Telefones e autorizações são fictícios. Nenhuma mensagem ou documento será enviado nesta demonstração.'
              : 'A autorização para saídas e a validade da assinatura dependem de definição da AE/TI.'
          }}
        </p>
      </div>
    </main>
  `,
})
export class GuardiansPage {
  readonly service = inject(ManagementDemoService);
  private readonly api = inject(GuardianApiService);
  private readonly residentApi = inject(ResidentApiService);
  private readonly session = inject(DemoSessionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly isDemo = this.session.active;
  readonly canEdit = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly scenario = this.session.scenario;
  readonly search = new FormControl('', { nonNullable: true });
  readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  readonly activeFilter = new FormControl('', { nonNullable: true });
  readonly residentFilter = new FormControl('', { nonNullable: true });
  private readonly activeQuery = toSignal(this.activeFilter.valueChanges, { initialValue: '' });
  private readonly residentQuery = toSignal(this.residentFilter.valueChanges, { initialValue: '' });
  readonly localGuardians = signal<GuardianRecord[]>([]);
  readonly residents = signal<ResidentRecord[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly filtered = computed(() => {
    if (!this.isDemo()) return this.localGuardians();
    const query = normalizeSearch(this.query());
    const items = this.isDemo() ? this.service.guardians() : this.localGuardians();
    return items.filter(
      (item) =>
        (!this.activeQuery() || item.active === (this.activeQuery() === 'true')) &&
        (!this.residentQuery() || item.residentId === this.residentQuery()) &&
        (!query ||
          normalizeSearch(
            `${item.name} ${item.phone ?? ''} ${this.residentName(item.residentId)} ${this.isDemo() ? this.service.resident(item.residentId)?.enrollment : (this.residents().find((r) => r.id === item.residentId)?.enrollment ?? '')}`,
          ).includes(query)),
    );
  });

  readonly remoteTotal = signal(0);
  readonly total = computed(() => (this.isDemo() ? this.filtered().length : this.remoteTotal()));
  readonly page = rememberValue('guardians.pages.ts-page', 0);
  readonly paged = computed(() =>
    this.isDemo()
      ? this.filtered().slice(this.page() * 25, (this.page() + 1) * 25)
      : this.filtered(),
  );

  constructor() {
    rememberFilters('guardians', this.search);
    rememberFilters('guardian-active', this.activeFilter);
    rememberFilters('guardian-resident', this.residentFilter);
    merge(
      this.search.valueChanges,
      this.activeFilter.valueChanges,
      this.residentFilter.valueChanges,
    )
      .pipe(debounceTime(250), takeUntilDestroyed())
      .subscribe(() => {
        this.page.set(0);
        if (!this.isDemo()) void this.load();
      });
    if (this.isDemo()) {
      const lastPage = Math.max(0, Math.ceil(this.filtered().length / 25) - 1);
      this.page.update((page) => Math.max(0, Math.min(page, lastPage)));
    } else void this.load();
  }

  residentName(id: string): string {
    return this.isDemo()
      ? (this.service.resident(id)?.name ?? 'residente não encontrado')
      : (this.residents().find((item) => item.id === id)?.name ?? 'residente não encontrado');
  }

  demoAuthorization(id: string): string {
    return this.service.guardian(id)?.authorized
      ? 'Autorizado para assinatura demonstrativa'
      : 'Sem autorização de assinatura demonstrativa';
  }

  retry(): void {
    if (this.isDemo()) this.session.setScenario('padrao');
    else void this.load();
  }

  private generation = 0;
  changePage(page: number): void {
    this.page.set(page);
    if (!this.isDemo()) void this.load();
  }
  async load(): Promise<void> {
    if (this.isDemo()) return;
    const generation = ++this.generation;
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const [guardians, residents] = await Promise.all([
        this.api.page({
          search: this.search.value,
          active: this.activeFilter.value,
          residentId: this.residentFilter.value,
          limit: '25',
          offset: String(this.page() * 25),
        }),
        this.residentApi.list(),
      ]);
      if (this.destroyRef.destroyed) return;
      if (generation !== this.generation) return;
      this.localGuardians.set(guardians.items);
      this.remoteTotal.set(guardians.total);
      this.residents.set(residents);
      if (this.page() && this.page() * 25 >= guardians.total) {
        this.changePage(Math.max(0, Math.ceil(guardians.total / 25) - 1));
      }
    } catch {
      if (this.destroyRef.destroyed || generation !== this.generation) return;
      this.localGuardians.set([]);
      this.residents.set([]);
      this.loadError.set(true);
    } finally {
      if (!this.destroyRef.destroyed && generation === this.generation) this.loading.set(false);
    }
  }
}

@Component({
  selector: 'app-guardian-detail',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page mg-narrow">
      @if (!canView()) {
        <section class="mg-empty" role="alert">
          <h1>Acesso restrito</h1>
          <p>Esta área está disponível para gestor e supervisor.</p>
          <a class="btn mg-primary" routerLink="/inicio">Voltar ao início</a>
        </section>
      } @else if (loading()) {
        <section class="mg-empty" role="status">
          <h1>Carregando responsável</h1>
          <p>Consultando o cadastro local de teste.</p>
        </section>
      } @else if (loadError()) {
        <section class="mg-empty" role="alert">
          <h1>
            {{
              missing() ? 'Responsável não encontrado' : 'Não foi possível carregar o responsável'
            }}
          </h1>
          <p>{{ loadError() }}</p>
          @if (!missing()) {
            <button class="btn mg-primary" type="button" (click)="load()">Tentar novamente</button>
          }
          <a class="btn mg-secondary" routerLink="/responsaveis">Voltar aos responsáveis</a>
        </section>
      } @else if (guardian(); as item) {
        <header class="mg-heading">
          <div>
            <a class="mg-back" routerLink="/responsaveis"
              ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
              Responsáveis</a
            >
            <h1>{{ item.name }}</h1>
            <p>Responsável legal · {{ item.relationship }}</p>
          </div>
          @if (canEdit()) {
            <a class="btn mg-primary" [routerLink]="['/responsaveis', item.id, 'editar']"
              ><span class="material-symbols-rounded" aria-hidden="true">edit</span> Editar
              responsável</a
            >
          }
        </header>
        @if (saved()) {
          <p class="mg-success" role="status">
            <span class="material-symbols-rounded" aria-hidden="true">check_circle</span>
            Responsável salvo {{ isDemo() ? 'nesta demonstração' : 'no ambiente local de teste' }}.
          </p>
        }
        <section class="panel mg-panel" aria-labelledby="guardian-data-title">
          <h2 id="guardian-data-title">Dados e vínculo</h2>
          <dl class="mg-details">
            <div>
              <dt>Nome completo</dt>
              <dd>{{ item.name }}</dd>
            </div>
            <div>
              <dt>Vínculo</dt>
              <dd>{{ item.relationship }}</dd>
            </div>
            <div>
              <dt>Telefone</dt>
              <dd>{{ item.phone || 'Não informado' }}</dd>
            </div>
            <div>
              <dt>Residente vinculado</dt>
              <dd>
                <a [routerLink]="['/residentes', item.residentId]">{{ residentName() }}</a>
              </dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{{ item.active ? 'Ativo' : 'Inativo' }}</dd>
            </div>
            <div>
              <dt>Assinatura de saída longa</dt>
              <dd>
                {{ isDemo() ? demoAuthorization() : 'Pendente de definição institucional' }}
              </dd>
            </div>
          </dl>
        </section>
        <div class="mg-note">
          <span class="material-symbols-rounded" aria-hidden="true">info</span>
          <p>
            O procedimento e a validade da assinatura dependem de definição institucional. Este
            vínculo não concede autorização de saída.
          </p>
        </div>
      } @else {
        <section class="mg-empty" role="alert">
          <h1>Responsável não encontrado</h1>
          <p>
            O cadastro solicitado não está disponível
            {{ isDemo() ? 'nesta demonstração' : 'no ambiente local de teste' }}.
          </p>
          <a class="btn mg-primary" routerLink="/responsaveis">Voltar aos responsáveis</a>
        </section>
      }
    </main>
  `,
})
export class GuardianDetailPage {
  private readonly service = inject(ManagementDemoService);
  private readonly api = inject(GuardianApiService);
  private readonly residentApi = inject(ResidentApiService);
  private readonly session = inject(DemoSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly isDemo = this.session.active;
  readonly canView = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly canEdit = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly localGuardian = signal<GuardianRecord | null>(null);
  readonly localResident = signal<ResidentRecord | null>(null);
  readonly guardian = computed(() =>
    this.isDemo() ? this.service.guardian(this.id) : this.localGuardian(),
  );
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly missing = signal(false);
  readonly saved = signal(this.route.snapshot.queryParamMap.get('saved') === '1');

  constructor() {
    if (!this.isDemo() && this.canView()) void this.load();
  }

  residentName(): string {
    const guardian = this.guardian();
    return this.isDemo()
      ? (this.service.resident(guardian?.residentId ?? '')?.name ?? 'Residente não encontrado')
      : (this.localResident()?.name ?? 'Residente não encontrado');
  }

  demoAuthorization(): string {
    return this.service.guardian(this.id)?.authorized
      ? 'Autorizado nesta demonstração'
      : 'Não autorizado nesta demonstração';
  }

  async load(): Promise<void> {
    if (this.isDemo() || !this.canView()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.missing.set(false);
    try {
      const item = await this.api.get(this.id);
      const resident = await this.residentApi.get(item.residentId);
      if (this.destroyRef.destroyed) return;
      this.localGuardian.set(item);
      this.localResident.set(resident);
    } catch (error) {
      if (this.destroyRef.destroyed) return;
      this.localGuardian.set(null);
      this.localResident.set(null);
      this.missing.set(error instanceof GuardianApiError && error.status === 404);
      this.loadError.set(
        this.missing()
          ? 'O cadastro solicitado não está disponível no ambiente local de teste.'
          : 'Confira a conexão com o backend local e tente novamente.',
      );
    } finally {
      if (!this.destroyRef.destroyed) this.loading.set(false);
    }
  }
}

@Component({
  selector: 'app-guardian-form',
  standalone: true,
  imports: [SearchableSelectDirective, UnsavedFormDirective, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page mg-narrow">
      @if (!canEdit()) {
        <section class="mg-empty" role="alert">
          <h1>Acesso restrito</h1>
          <p>O cadastro de responsáveis está disponível para gestor e supervisor.</p>
          <a class="btn mg-primary" routerLink="/responsaveis">Voltar aos responsáveis</a>
        </section>
      } @else if (loading()) {
        <section class="mg-empty" role="status">
          <h1>Carregando cadastro</h1>
          <p>Consultando os dados locais de teste.</p>
        </section>
      } @else if (loadError()) {
        <section class="mg-empty" role="alert">
          <h1>
            {{ missing() ? 'Responsável não encontrado' : 'Não foi possível carregar o cadastro' }}
          </h1>
          <p>{{ loadError() }}</p>
          @if (!missing()) {
            <button class="btn mg-primary" type="button" (click)="load()">Tentar novamente</button>
          }
          <a class="btn mg-secondary" routerLink="/responsaveis">Voltar aos responsáveis</a>
        </section>
      } @else {
        <header class="mg-heading">
          <div>
            <a class="mg-back" routerLink="/responsaveis"
              ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
              Responsáveis</a
            >
            <h1>{{ editId ? 'Editar responsável' : 'Cadastrar responsável' }}</h1>
            <p>Vincule o contato a um residente.</p>
          </div>
        </header>
        <form
          sagerUnsaved
          [sagerSaving]="saving"
          class="panel mg-panel mg-form"
          [formGroup]="form"
          (ngSubmit)="save()"
          novalidate
        >
          <h2>Dados do responsável</h2>
          <p class="mg-muted">
            Campos marcados com * são obrigatórios. Use somente dados fictícios
            {{ isDemo() ? 'nesta demonstração' : 'no ambiente local de teste' }}.
          </p>
          <div class="form-grid mg-form-grid">
            <label
              class="field mg-field mg-span-2"
              [class.mg-invalid]="
                form.controls.residentId.invalid && form.controls.residentId.touched
              "
              >Residente vinculado *
              <select
                sagerSearchable
                formControlName="residentId"
                aria-describedby="guardian-resident-error"
              >
                <option value="">Selecione um residente</option>
                @for (resident of residents(); track resident.id) {
                  <option [value]="resident.id">{{ resident.name }}</option>
                }
              </select>
              @if (form.controls.residentId.invalid && form.controls.residentId.touched) {
                <span class="mg-field-error" id="guardian-resident-error"
                  >Selecione um residente.</span
                >
              }
            </label>
            <label
              class="field mg-field mg-span-2"
              [class.mg-invalid]="form.controls.name.invalid && form.controls.name.touched"
              >Nome completo *<input
                formControlName="name"
                autocomplete="name"
                maxlength="200"
                aria-describedby="guardian-name-error"
              />
              @if (form.controls.name.invalid && form.controls.name.touched) {
                <span class="mg-field-error" id="guardian-name-error"
                  >Informe o nome com 3 a 200 caracteres.</span
                >
              }
            </label>
            <label
              class="field mg-field"
              [class.mg-invalid]="
                form.controls.relationship.invalid && form.controls.relationship.touched
              "
              >Vínculo com o residente *<input
                formControlName="relationship"
                placeholder="Ex.: mãe, pai ou pessoa com guarda"
                maxlength="80"
                aria-describedby="guardian-relationship-error"
              />
              @if (form.controls.relationship.invalid && form.controls.relationship.touched) {
                <span class="mg-field-error" id="guardian-relationship-error"
                  >Informe o vínculo com 2 a 80 caracteres.</span
                >
              }
            </label>
            <label
              class="field mg-field"
              [class.mg-invalid]="form.controls.phone.invalid && form.controls.phone.touched"
              >Telefone {{ isDemo() ? 'com DDD *' : '(opcional)'
              }}<input
                type="tel"
                formControlName="phone"
                autocomplete="tel"
                maxlength="30"
                aria-describedby="guardian-phone-error"
              />
              @if (form.controls.phone.invalid && form.controls.phone.touched) {
                <span class="mg-field-error" id="guardian-phone-error">{{
                  isDemo()
                    ? 'Informe 10 ou 11 dígitos, incluindo o DDD.'
                    : 'O telefone pode ter até 30 caracteres.'
                }}</span>
              }
            </label>
          </div>
          <label class="mg-check"
            ><input type="checkbox" formControlName="active" /> Responsável ativo</label
          >
          @if (isDemo()) {
            <label class="mg-check"
              ><input type="checkbox" formControlName="authorized" /> Autorizado para assinatura
              demonstrativa</label
            >
          }
          <div class="mg-note">
            <span class="material-symbols-rounded" aria-hidden="true">info</span>
            <p>
              Nenhuma mensagem será enviada. A autorização de saída e a assinatura válida dependem
              de definição institucional.
            </p>
          </div>
          @if (error()) {
            <p class="mg-alert" role="alert">{{ error() }}</p>
          }
          @if (conflict()) {
            <button type="button" class="btn mg-secondary" (click)="reloadLatest()">
              Carregar versão atual do cadastro
            </button>
          }
          <div class="action-row mg-actions">
            <a
              class="btn mg-secondary"
              [routerLink]="editId ? ['/responsaveis', editId] : ['/responsaveis']"
              >Cancelar</a
            ><button class="btn mg-primary" type="submit" [disabled]="submitting()">
              <span class="material-symbols-rounded" aria-hidden="true">save</span>
              {{ submitting() ? 'Salvando…' : 'Salvar responsável' }}
            </button>
          </div>
        </form>
      }
    </main>
  `,
})
export class GuardianFormPage {
  private readonly service = inject(ManagementDemoService);
  private readonly api = inject(GuardianApiService);
  private readonly residentApi = inject(ResidentApiService);
  private readonly session = inject(DemoSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly editId = this.route.snapshot.paramMap.get('id');
  readonly isDemo = this.session.active;
  readonly canEdit = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly residents = signal<ReadonlyArray<{ id: string; name: string }>>([]);
  readonly localGuardian = signal<GuardianRecord | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly missing = signal(false);
  readonly error = signal('');
  readonly conflict = signal(false);
  readonly saving = signal(false);
  readonly submitting = signal(false);
  readonly form = new FormGroup({
    residentId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [trimmedLength(3, 200)],
    }),
    relationship: new FormControl('', {
      nonNullable: true,
      validators: [trimmedLength(2, 80)],
    }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(30)] }),
    active: new FormControl(true, { nonNullable: true }),
    authorized: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    if (!this.canEdit()) return;
    if (this.isDemo()) {
      this.form.controls.phone.setValidators([
        Validators.required,
        Validators.pattern(/^\d{10,11}$/),
      ]);
      this.form.controls.phone.updateValueAndValidity({ emitEvent: false });
      this.residents.set(this.service.residents());
      const existing = this.editId ? this.service.guardian(this.editId) : undefined;
      if (existing) {
        this.setFields(existing);
        this.form.controls.residentId.disable();
      } else if (this.editId) {
        this.missing.set(true);
        this.loadError.set('O cadastro solicitado não está disponível nesta demonstração.');
      } else {
        const residentId = this.route.snapshot.queryParamMap.get('residente');
        if (residentId && this.service.resident(residentId))
          this.form.controls.residentId.setValue(residentId);
      }
    } else {
      void this.load();
    }
  }

  private setFields(
    item:
      | GuardianRecord
      | {
          residentId: string;
          name: string;
          relationship: string;
          phone: string;
          active: boolean;
          authorized: boolean;
        },
  ): void {
    this.form.setValue({
      residentId: item.residentId,
      name: item.name,
      relationship: item.relationship,
      phone: item.phone ?? '',
      active: item.active,
      authorized: 'authorized' in item ? item.authorized : false,
    });
  }

  async load(): Promise<void> {
    if (this.isDemo() || !this.canEdit()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.missing.set(false);
    try {
      const [residents, guardian] = await Promise.all([
        this.residentApi.list(),
        this.editId ? this.api.get(this.editId) : Promise.resolve(null),
      ]);
      if (this.destroyRef.destroyed) return;
      this.residents.set(residents);
      this.localGuardian.set(guardian);
      if (guardian) this.setFields(guardian);
      else {
        const residentId = this.route.snapshot.queryParamMap.get('residente');
        if (residentId && residents.some((item) => item.id === residentId)) {
          this.form.controls.residentId.setValue(residentId);
        }
      }
    } catch (error) {
      if (this.destroyRef.destroyed) return;
      this.residents.set([]);
      this.localGuardian.set(null);
      this.missing.set(error instanceof GuardianApiError && error.status === 404);
      this.loadError.set(
        this.missing()
          ? 'O cadastro solicitado não está disponível no ambiente local de teste.'
          : 'Confira a conexão com o backend local e tente novamente.',
      );
    } finally {
      if (!this.destroyRef.destroyed) this.loading.set(false);
    }
  }

  async reloadLatest(): Promise<void> {
    this.conflict.set(false);
    this.error.set('');
    await this.load();
  }

  async save(): Promise<void> {
    if (!this.canEdit() || this.submitting()) return;
    this.error.set('');
    this.conflict.set(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.submitting.set(true);
    try {
      let item: GuardianRecord;
      if (this.isDemo()) {
        const { residentId, ...input } = value;
        item = this.service.saveGuardian(
          residentId,
          { ...input, phone: input.phone.trim() },
          this.localGuardian()?.id ?? this.editId ?? undefined,
        );
      } else {
        this.saving.set(true);
        item = await this.api.save(
          {
            residentId: value.residentId,
            name: value.name.trim(),
            relationship: value.relationship.trim(),
            phone: value.phone.trim() || null,
            active: value.active,
          },
          this.localGuardian() ?? undefined,
        );
      }
      if (this.destroyRef.destroyed) return;
      this.localGuardian.set(item);
      this.saving.set(false);
      this.form.markAsPristine();
      const navigationError =
        'O responsável foi salvo, mas não foi possível abrir o cadastro. Tente novamente ou volte à lista.';
      try {
        const navigated = await this.router.navigate(['/responsaveis', item.id], {
          queryParams: { saved: '1' },
        });
        if (!navigated && !this.destroyRef.destroyed) this.error.set(navigationError);
      } catch {
        if (!this.destroyRef.destroyed) this.error.set(navigationError);
      }
    } catch (error) {
      if (this.destroyRef.destroyed) return;
      if (this.isDemo()) {
        this.error.set(
          error instanceof Error ? error.message : 'Não foi possível salvar o responsável.',
        );
      } else if (
        error instanceof GuardianApiError &&
        (error.status === 409 || error.code === 'stale_version')
      ) {
        this.conflict.set(true);
        this.error.set(
          'O responsável foi alterado por outra sessão. Carregue a versão atual antes de salvar.',
        );
      } else if (error instanceof GuardianApiError && error.status === 422) {
        this.error.set('O residente selecionado não está mais disponível. Atualize o cadastro.');
      } else if (error instanceof GuardianApiError && error.status === 400) {
        this.error.set('Os dados foram recusados. Revise os campos e tente novamente.');
      } else {
        this.error.set(
          'Não foi possível salvar o responsável. Confira a conexão e tente novamente.',
        );
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.saving.set(false);
        this.submitting.set(false);
      }
    }
  }
}
