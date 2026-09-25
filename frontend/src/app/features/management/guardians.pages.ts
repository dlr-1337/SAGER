import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';

@Component({
  selector: 'app-guardians',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page">
      <header class="mg-heading"><div><a class="mg-back" routerLink="/residentes"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Residentes</a><h1>Responsáveis legais</h1><p>Consulte os vínculos e as autorizações demonstrativas de cada residente.</p></div><a class="btn mg-primary" routerLink="/responsaveis/novo"><span class="material-symbols-rounded" aria-hidden="true">person_add</span> Cadastrar responsável</a></header>
      <section class="panel mg-panel" aria-labelledby="guardian-search-title"><h2 id="guardian-search-title">Buscar responsáveis</h2><label class="field mg-field">Nome do responsável ou residente<input type="search" [formControl]="search" placeholder="Digite um nome" autocomplete="off" /></label></section>
      <section class="mg-section" aria-labelledby="guardian-results-title"><div class="mg-section-heading"><h2 id="guardian-results-title">Responsáveis cadastrados</h2><p aria-live="polite">{{ scenario() === 'padrao' ? filtered().length + ' registros' : 'Cenário demonstrativo' }}</p></div>
        @if (scenario() === 'carregando') { <div class="mg-empty" role="status"><span class="material-symbols-rounded mg-loading-icon" aria-hidden="true">progress_activity</span><h3>Carregando responsáveis</h3><p>Estado simulado para avaliar a interface.</p><button class="btn mg-secondary" type="button" (click)="restore()">Voltar ao cenário padrão</button></div> }
        @else if (scenario() === 'erro') { <div class="mg-empty" role="alert"><span class="material-symbols-rounded" aria-hidden="true">error</span><h3>Não foi possível carregar responsáveis</h3><p>Falha simulada. Tente novamente para ver os registros fictícios.</p><button class="btn mg-primary" type="button" (click)="restore()">Tentar novamente</button></div> }
        @else if (scenario() === 'vazio') { <div class="mg-empty" role="status"><span class="material-symbols-rounded" aria-hidden="true">group_off</span><h3>Nenhum responsável cadastrado</h3><p>Estado vazio da demonstração.</p><button class="btn mg-secondary" type="button" (click)="restore()">Voltar ao cenário padrão</button></div> }
        @else if (filtered().length) { <div class="mg-list">@for (item of filtered(); track item.id) { <article class="mg-row"><div class="mg-avatar" aria-hidden="true">{{ item.name.slice(0, 1) }}</div><div class="mg-row-main"><h3>{{ item.name }}</h3><p>{{ item.relationship }} de {{ service.resident(item.residentId)?.name ?? 'residente não encontrado' }}</p></div><div class="mg-row-detail"><strong>{{ item.active ? 'Ativo' : 'Inativo' }}</strong><span>{{ item.authorized ? 'Autorizado para assinatura' : 'Sem autorização de assinatura' }}</span></div><a class="mg-row-link" [routerLink]="['/responsaveis', item.id]">Ver detalhes <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></a></article> }</div> }
        @else { <div class="mg-empty" role="status"><span class="material-symbols-rounded" aria-hidden="true">search_off</span><h3>Nenhum responsável encontrado</h3><p>Confira a busca ou limpe o campo.</p><button class="btn mg-secondary" type="button" (click)="search.setValue('')">Limpar busca</button></div> }
      </section>
      <div class="mg-note"><span class="material-symbols-rounded" aria-hidden="true">info</span><p>Telefones e autorizações são fictícios. Nenhuma mensagem ou documento será enviado nesta demonstração.</p></div>
    </main>
  `,
})
export class GuardiansPage {
  readonly service = inject(ManagementDemoService);
  private readonly session = inject(DemoSessionService);
  readonly scenario = this.session.scenario;
  readonly search = new FormControl('', { nonNullable: true });
  private readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  readonly filtered = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('pt-BR');
    return this.service.guardians().filter(item => !query || `${item.name} ${this.service.resident(item.residentId)?.name ?? ''}`.toLocaleLowerCase('pt-BR').includes(query));
  });

  restore(): void { this.session.setScenario('padrao'); }
}

@Component({
  selector: 'app-guardian-detail',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page mg-narrow">
      @if (guardian(); as item) {
        <header class="mg-heading"><div><a class="mg-back" routerLink="/responsaveis"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Responsáveis</a><h1>{{ item.name }}</h1><p>Responsável legal · {{ item.relationship }}</p></div><a class="btn mg-primary" [routerLink]="['/responsaveis', item.id, 'editar']"><span class="material-symbols-rounded" aria-hidden="true">edit</span> Editar responsável</a></header>
        @if (saved()) { <p class="mg-success" role="status"><span class="material-symbols-rounded" aria-hidden="true">check_circle</span> Responsável salvo nesta demonstração.</p> }
        <section class="panel mg-panel" aria-labelledby="guardian-data-title"><h2 id="guardian-data-title">Dados e vínculo</h2><dl class="mg-details"><div><dt>Nome completo</dt><dd>{{ item.name }}</dd></div><div><dt>Vínculo</dt><dd>{{ item.relationship }}</dd></div><div><dt>Telefone</dt><dd>{{ item.phone }}</dd></div><div><dt>Residente vinculado</dt><dd><a [routerLink]="['/residentes', item.residentId]">{{ service.resident(item.residentId)?.name ?? 'Residente não encontrado' }}</a></dd></div><div><dt>Situação</dt><dd>{{ item.active ? 'Ativo' : 'Inativo' }}</dd></div><div><dt>Assinatura de saída longa</dt><dd>{{ item.authorized ? 'Autorizado' : 'Não autorizado' }}</dd></div></dl></section>
        <div class="mg-note"><span class="material-symbols-rounded" aria-hidden="true">info</span><p>Esta autorização é apenas um exemplo de cadastro. O procedimento e a validade da assinatura dependem de definição institucional.</p></div>
      } @else { <section class="mg-empty" role="alert"><h1>Responsável não encontrado</h1><p>O cadastro solicitado não está disponível nesta demonstração.</p><a class="btn mg-primary" routerLink="/responsaveis">Voltar aos responsáveis</a></section> }
    </main>
  `,
})
export class GuardianDetailPage {
  readonly service = inject(ManagementDemoService);
  private readonly route = inject(ActivatedRoute);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly guardian = computed(() => this.service.guardian(this.id));
  readonly saved = signal(this.route.snapshot.queryParamMap.get('saved') === '1');
}

@Component({
  selector: 'app-guardian-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page mg-narrow">
      @if (editId && !guardian()) { <section class="mg-empty" role="alert"><h1>Responsável não encontrado</h1><p>O cadastro solicitado não está disponível nesta demonstração.</p><a class="btn mg-primary" routerLink="/responsaveis">Voltar aos responsáveis</a></section> }
      @else {
        <header class="mg-heading"><div><a class="mg-back" routerLink="/responsaveis"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Responsáveis</a><h1>{{ editId ? 'Editar responsável' : 'Cadastrar responsável' }}</h1><p>Vincule o contato a um residente e confira a autorização.</p></div></header>
        <form class="panel mg-panel mg-form" [formGroup]="form" (ngSubmit)="save()" novalidate><h2>Dados do responsável</h2><p class="mg-muted">Campos marcados com * são obrigatórios.</p><div class="form-grid mg-form-grid">
          <label class="field mg-field mg-span-2">Residente vinculado *<select formControlName="residentId"><option value="">Selecione um residente</option>@for (resident of service.residents(); track resident.id) { <option [value]="resident.id">{{ resident.name }}</option> }</select>@if (form.controls.residentId.invalid && form.controls.residentId.touched) { <span class="mg-field-error">Selecione um residente.</span> }</label>
          <label class="field mg-field mg-span-2">Nome completo *<input formControlName="name" autocomplete="name" />@if (form.controls.name.invalid && form.controls.name.touched) { <span class="mg-field-error">Informe o nome com pelo menos 3 caracteres.</span> }</label>
          <label class="field mg-field">Vínculo com o residente *<input formControlName="relationship" placeholder="Ex.: mãe, pai ou tutor" />@if (form.controls.relationship.invalid && form.controls.relationship.touched) { <span class="mg-field-error">Informe o vínculo com o residente.</span> }</label>
          <label class="field mg-field">Telefone com DDD *<input type="tel" formControlName="phone" inputmode="numeric" autocomplete="tel" placeholder="Somente números" />@if (form.controls.phone.invalid && form.controls.phone.touched) { <span class="mg-field-error">Informe 10 ou 11 dígitos, incluindo o DDD.</span> }</label>
        </div><label class="mg-check"><input type="checkbox" formControlName="active" /> Responsável ativo</label><label class="mg-check"><input type="checkbox" formControlName="authorized" /> Autorizado para assinatura de saída longa</label>
        <div class="mg-note"><span class="material-symbols-rounded" aria-hidden="true">info</span><p>Nenhuma mensagem será enviada e nenhuma assinatura válida será produzida nesta demonstração.</p></div>
        @if (error()) { <p class="mg-alert" role="alert">{{ error() }}</p> }
        <div class="action-row mg-actions"><a class="btn mg-secondary" routerLink="/responsaveis">Cancelar</a><button class="btn mg-primary" type="submit"><span class="material-symbols-rounded" aria-hidden="true">save</span> Salvar responsável</button></div></form>
      }
    </main>
  `,
})
export class GuardianFormPage {
  readonly service = inject(ManagementDemoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly editId = this.route.snapshot.paramMap.get('id');
  readonly guardian = computed(() => this.editId ? this.service.guardian(this.editId) : undefined);
  readonly error = signal('');
  readonly form = new FormGroup({
    residentId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    relationship: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{10,11}$/)] }),
    active: new FormControl(true, { nonNullable: true }),
    authorized: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    const existing = this.guardian();
    if (existing) {
      this.form.setValue({ residentId: existing.residentId, name: existing.name, relationship: existing.relationship, phone: existing.phone, active: existing.active, authorized: existing.authorized });
      this.form.controls.residentId.disable();
    } else {
      const residentId = this.route.snapshot.queryParamMap.get('residente');
      if (residentId && this.service.resident(residentId)) this.form.controls.residentId.setValue(residentId);
    }
  }

  save(): void {
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    try {
      const { residentId, ...input } = this.form.getRawValue();
      const item = this.service.saveGuardian(residentId, input, this.editId ?? undefined);
      void this.router.navigate(['/responsaveis', item.id], { queryParams: { saved: '1' } });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Não foi possível salvar o responsável. Tente novamente.');
    }
  }
}
