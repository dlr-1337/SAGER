import { ERROR_GENERIC, readableError } from '../../core/error-messages';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { LocalAuthService } from '../../core/local-auth.service';
import { PasswordFieldComponent } from '../../shared/password-field.component';
import { OperationsDemoService } from '../operations/operations-demo.service';
import { DemoEntry } from './demo-entry.service';
import { LocalHomePage } from './local-home.page';

@Component({
  standalone: true,
  selector: 'sager-access',
  imports: [RouterLink, ReactiveFormsModule, PasswordFieldComponent],
  providers: [DemoEntry],
  template: `
    <header class="masthead public-masthead">
      <div class="brand-organization">
        <img src="/if-goiano-urutai.png" alt="Instituto Federal Goiano, Campus Urutaí" />
      </div>
      <div class="brand-product">
        <strong>SAGER</strong><span>Sistema de Apoio à Gestão da<br />Residência Estudantil</span>
      </div>
      @if (!session.production) {
        <div class="demo-flag">
          <strong>Acesso local</strong><span>Desenvolvimento e testes</span>
        </div>
      }
    </header>
    <main class="access-main" [class.solo]="!session.demoAvailable">
      <section class="access-login" aria-labelledby="access-title">
        <div class="access-head">
          <span class="eyebrow">Assistência Estudantil · Campus Urutaí</span>
          <h1 id="access-title">Entrar no SAGER</h1>
          <p class="lead">
            {{
              session.production
                ? 'Entre com sua matrícula e a senha do SAGER.'
                : 'Entre com a matrícula e a senha local. Este ambiente usa dados sintéticos.'
            }}
          </p>
        </div>
        <form class="access-card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label for="login-enrollment">Matrícula</label>
            <input
              id="login-enrollment"
              type="text"
              formControlName="matricula"
              autocomplete="username"
              required
            />
          </div>
          <div class="field">
            <label for="login-password">Senha</label>
            <sager-password-field>
              <input
                id="login-password"
                type="password"
                formControlName="password"
                autocomplete="current-password"
                required
              />
            </sager-password-field>
          </div>
          @if (error()) {
            <p class="access-error" role="alert">{{ error() }}</p>
          }
          <button class="btn" type="submit" [disabled]="busy()">
            <span class="material-symbols-outlined" aria-hidden="true">login</span
            >{{ busy() ? 'Entrando...' : 'Entrar' }}
          </button>
          <div class="access-support">
            <a routerLink="/recuperar-senha">Esqueci minha senha</a>
            @if (!session.demoAvailable) {
              <a routerLink="/ajuda">Ajuda para acessar</a>
              <span>É supervisor ou gestor? Peça ao suporte para trocar sua senha.</span>
            }
          </div>
        </form>
      </section>
      @if (session.demoAvailable) {
        <section class="access-demo" aria-labelledby="demo-title">
          <span class="status info"
            ><span class="material-symbols-outlined" aria-hidden="true">science</span>Somente
            demonstração</span
          >
          <h2 id="demo-title">Explorar com um perfil fictício</h2>
          <p>
            Explore as telas sem conta. A demonstração é pública e usa somente exemplos fictícios.
          </p>
          <div class="demo-options" [attr.aria-busy]="demo.busy()">
            @for (option of demo.options; track option.role) {
              <button
                type="button"
                class="demo-option"
                [disabled]="demo.busy()"
                (click)="demo.choose(option.role)"
              >
                <span class="material-symbols-outlined" aria-hidden="true">{{ option.icon }}</span
                ><strong>{{ option.title }}</strong
                ><span>{{ option.description }}</span>
              </button>
            }
          </div>
          @if (demo.error()) {
            <p class="access-error" role="alert">{{ demo.error() }}</p>
          }
          <div class="access-support">
            <a routerLink="/demonstracao">Explorar demonstração</a
            ><a routerLink="/ajuda">Como funciona a demonstração</a>
          </div>
        </section>
      }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: var(--surface);
      }
      .access-main {
        display: flex;
        flex-wrap: wrap;
        gap: 24px;
        max-width: 1120px;
        margin: 0 auto;
        padding: 56px clamp(16px, 3vw, 40px) 48px;
      }
      .access-main.solo {
        max-width: 640px;
      }
      .access-login {
        flex: 999 1 420px;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .access-head {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      h1 {
        margin: 0;
        font-size: clamp(1.8rem, 2.6vw, 2.25rem);
        font-weight: 800;
        line-height: 1.15;
        letter-spacing: -0.025em;
      }
      .lead {
        margin: 0;
      }
      .access-card,
      .access-demo {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 32px;
        border: 1px solid var(--line);
        border-radius: var(--radius-card);
        background: #fff;
        box-shadow: var(--shadow);
      }
      .access-card .btn {
        width: 100%;
      }
      .access-error {
        margin: 0;
        padding: 12px 16px;
        border-radius: 12px;
        background: var(--danger-bg);
        color: var(--danger-ink);
        font-weight: 700;
      }
      .access-support {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 4px 16px;
        font-size: var(--text-meta);
        color: var(--muted);
      }
      .access-support a {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        font-size: 1rem;
        font-weight: 600;
      }
      .access-demo {
        flex: 1 1 380px;
        min-width: 0;
        gap: 16px;
        padding: 24px;
        border-color: var(--success-line);
        background: var(--green-50);
        box-shadow: none;
      }
      .access-demo h2 {
        margin: 0;
        font-size: 1.4rem;
      }
      .access-demo p {
        margin: 0;
      }
      .demo-options {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .demo-option {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: 2px 12px;
        min-height: 56px;
        padding: 10px 16px;
        border: 1px solid var(--btn-secondary-border);
        border-radius: var(--radius-control);
        background: #fff;
        color: var(--green-900);
        font-weight: 700;
        text-align: left;
      }
      .demo-option:hover {
        background: var(--green-50);
        color: var(--green-950);
      }
      .demo-option .material-symbols-outlined {
        grid-row: span 2;
      }
      .demo-option span:last-child {
        font-size: var(--text-meta);
        font-weight: 400;
        color: var(--muted);
      }
      @media (max-width: 760px) {
        .access-main {
          padding-top: 24px;
        }
        .access-card,
        .access-demo {
          padding: 18px;
        }
      }
    `,
  ],
})
export class AccessPage {
  private readonly auth = inject(LocalAuthService);
  readonly session = inject(DemoSessionService);
  private readonly router = inject(Router);
  readonly demo = inject(DemoEntry);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup({
    matricula: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(64)],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  async submit(): Promise<void> {
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Informe sua matrícula e senha.');
      return;
    }
    this.busy.set(true);
    try {
      const result = await this.auth.login(
        this.form.controls.matricula.value.trim(),
        this.form.controls.password.value,
      );
      if (result === 'invalid') {
        this.error.set(
          'Matrícula ou senha errada. Confira e tente de novo. Se continuar, clique em Esqueci minha senha.',
        );
        return;
      }
      this.session.deactivate();
      this.form.controls.password.reset();
      await this.router.navigateByUrl('/inicio');
    } catch (error) {
      this.error.set(
        readableError(
          error,
          this.session.production
            ? ERROR_GENERIC
            : 'O login local está indisponível. Você ainda pode explorar a demonstração.',
        ),
      );
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  standalone: true,
  selector: 'sager-demo-selector',
  imports: [],
  providers: [DemoEntry],
  template: `
    <main class="page demo-choice">
      <div class="page-header">
        <div>
          <span class="eyebrow">Primeiro acesso</span>
          <h1>Escolha uma experiência</h1>
          <p>Os perfis usam exemplos fictícios para mostrar cada jornada.</p>
        </div>
      </div>
      <div class="role-grid" [attr.aria-busy]="demo.busy()">
        @for (option of demo.options; track option.role) {
          <button
            type="button"
            class="role-card"
            [disabled]="demo.busy()"
            (click)="demo.choose(option.role)"
          >
            <span class="material-symbols-outlined" aria-hidden="true">{{ option.icon }}</span>
            <strong>{{ option.title }}</strong
            ><span>{{ option.description }}</span>
            <span class="role-action"
              >Entrar como {{ option.title.toLowerCase() }}
              <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></span
            >
          </button>
        }
      </div>
      @if (demo.error()) {
        <p class="demo-error" role="alert">{{ demo.error() }}</p>
      }
      <p class="demo-note">
        <span class="material-symbols-outlined" aria-hidden="true">info</span>As ações alteram
        apenas a demonstração nesta sessão. Nenhum cadastro real será criado.
      </p>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .demo-choice {
        max-width: 1100px;
        margin: auto;
        padding-top: 56px;
      }
      .role-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 24px;
        margin: 32px 0;
      }
      .role-card {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        min-height: 260px;
        padding: 24px;
        border: 1px solid var(--line);
        border-radius: var(--radius-card);
        background: #fff;
        box-shadow: var(--shadow);
        color: var(--ink);
        text-align: left;
      }
      .role-card:hover {
        border-color: var(--green-800);
      }
      .role-card:disabled {
        cursor: wait;
      }
      .role-card > .material-symbols-outlined {
        display: grid;
        place-items: center;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--green-100);
        color: var(--green-900);
      }
      .role-card strong {
        font-size: 1.25rem;
      }
      .role-card > span:not(.material-symbols-outlined):not(.role-action) {
        line-height: 1.5;
        color: var(--muted);
      }
      .role-action {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: auto;
        color: var(--green-800);
        font-weight: 700;
      }
      .demo-note,
      .demo-error {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        max-width: none;
        padding: 16px 18px;
        border-radius: 12px;
        background: var(--info-bg);
        color: var(--info-ink);
      }
      .demo-error {
        background: var(--danger-bg);
        color: var(--danger-ink);
        font-weight: 700;
      }
      @media (max-width: 760px) {
        .role-grid {
          grid-template-columns: 1fr;
        }
        .role-card {
          min-height: 0;
          padding: 18px;
        }
      }
    `,
  ],
})
export class DemoSelectorPage {
  readonly demo = inject(DemoEntry);
}

@Component({
  standalone: true,
  selector: 'sager-home',
  imports: [RouterLink, LocalHomePage],
  template: `
    @if (!session.active()) {
      <sager-local-home />
    } @else {
      <main class="page">
        <header class="home-heading">
          <div>
            <span class="eyebrow">SAGER · Campus Urutaí</span>
            <h1>{{ heading() }}</h1>
            <p>{{ intro() }}</p>
          </div>
          <span class="status">Dados fictícios</span>
        </header>
        @if (session.role() === 'supervisor') {
          <div class="home-columns">
            <section class="home-main">
              <div class="feature-task home-hero">
                <div class="task-icon">
                  <span class="material-symbols-outlined home-hero-icon" aria-hidden="true"
                    >fact_check</span
                  >
                </div>
                <div>
                  <span class="eyebrow">Próxima atividade</span>
                  <h2>Chamada noturna</h2>
                  <p>
                    Confira a presença dos residentes menores de idade e revise as marcações antes
                    de registrar.
                  </p>
                  <span class="task-time"
                    ><span class="material-symbols-outlined" aria-hidden="true">schedule</span
                    >Prevista para 22h30</span
                  >
                </div>
                <a class="btn" routerLink="/chamada">Abrir chamada</a>
              </div>
              <section class="work-list" aria-labelledby="pending-title">
                <div class="section-heading">
                  <h2 id="pending-title">Pendências para revisar</h2>
                  <span>Organizadas por tarefa</span>
                </div>
                <a class="work-row" routerLink="/saidas"
                  ><span class="row-indicator home-badge amber"
                    ><span class="material-symbols-outlined" aria-hidden="true"
                      >directions_walk</span
                    ></span
                  ><span class="row-copy"
                    ><strong>
                      @if (countsAvailable()) {
                        {{ pendingExitCount() }}
                        {{
                          pendingExitCount() === 1 ? 'saída para analisar' : 'saídas para analisar'
                        }}
                      } @else {
                        Saídas para analisar
                      }</strong
                    ><small>Revise cada solicitação antes da decisão.</small></span
                  ><span class="row-status"
                    ><strong>{{
                      countsAvailable() ? pendingExitStatus() : 'Cenário de demonstração'
                    }}</strong
                    ><small>{{
                      countsAvailable()
                        ? 'Saídas longas exigem autorização conferida.'
                        : 'Contagens indisponíveis neste cenário.'
                    }}</small></span
                  ><span class="row-tail"
                    >Abrir fila
                    <span class="material-symbols-outlined" aria-hidden="true"
                      >arrow_forward</span
                    ></span
                  ></a
                >
                <a class="work-row" routerLink="/saidas"
                  ><span class="row-indicator home-badge blue"
                    ><span class="material-symbols-outlined" aria-hidden="true"
                      >how_to_reg</span
                    ></span
                  ><span class="row-copy"
                    ><strong>
                      @if (countsAvailable()) {
                        {{ shortReturnCount() }}
                        {{
                          shortReturnCount() === 1
                            ? 'retorno curto para confirmar'
                            : 'retornos curtos para confirmar'
                        }}
                      } @else {
                        Retornos curtos para confirmar
                      }</strong
                    ><small>Verifique a chegada antes de confirmar o retorno.</small></span
                  ><span class="row-status"
                    ><strong>{{
                      countsAvailable() ? shortReturnStatus() : 'Cenário de demonstração'
                    }}</strong
                    ><small>{{
                      countsAvailable()
                        ? 'A confirmação é feita pelo supervisor.'
                        : 'Contagens indisponíveis neste cenário.'
                    }}</small></span
                  ><span class="row-tail"
                    >Ver retornos
                    <span class="material-symbols-outlined" aria-hidden="true"
                      >arrow_forward</span
                    ></span
                  ></a
                >
                <a class="work-row" routerLink="/notificacoes"
                  ><span class="row-indicator home-badge green"
                    ><span class="material-symbols-outlined" aria-hidden="true"
                      >notification_important</span
                    ></span
                  ><span class="row-copy"
                    ><strong>
                      @if (countsAvailable()) {
                        {{ notificationCount() }}
                        {{
                          notificationCount() === 1
                            ? 'notificação sem decisão'
                            : 'notificações sem decisão'
                        }}
                      } @else {
                        Notificações internas para revisar
                      }</strong
                    ><small>Analise cada ocorrência; nenhuma advertência é automática.</small></span
                  ><span class="row-status"
                    ><strong>{{
                      countsAvailable() ? notificationStatus() : 'Cenário de demonstração'
                    }}</strong
                    ><small>{{
                      countsAvailable()
                        ? 'Pendentes ou em análise.'
                        : 'Contagens indisponíveis neste cenário.'
                    }}</small></span
                  ><span class="row-tail"
                    >Ver notificações
                    <span class="material-symbols-outlined" aria-hidden="true"
                      >arrow_forward</span
                    ></span
                  ></a
                >
              </section>
            </section>
            <aside class="home-aside">
              <section class="aside-block">
                <h2>Agenda de hoje</h2>
                <div class="agenda-line"><strong>22h30</strong><span>Chamada noturna</span></div>
                <p>Horários e atividades são exemplos de demonstração.</p>
              </section>
              <section class="aside-block">
                <h2>Ajuda rápida</h2>
                <p>Confira os passos de cada tarefa antes de registrar uma decisão.</p>
                <a routerLink="/ajuda"
                  >Abrir ajuda
                  <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></a
                >
              </section>
            </aside>
          </div>
        } @else if (session.role() === 'gestor') {
          <div class="home-columns">
            <section class="home-main">
              <div class="feature-task home-hero">
                <div class="task-icon">
                  <span class="material-symbols-outlined home-hero-icon" aria-hidden="true"
                    >apartment</span
                  >
                </div>
                <div>
                  <span class="eyebrow">Visão da residência</span>
                  <h2>Cadastros e ocupação</h2>
                  <p>
                    Consulte os residentes e confira a distribuição dos quartos antes de atualizar
                    registros.
                  </p>
                </div>
                <a class="btn" routerLink="/residentes">Ver residentes</a>
              </div>
              <section class="work-list">
                <div class="section-heading">
                  <h2>Atalhos de gestão</h2>
                  <span>Exemplos de navegação</span>
                </div>
                <a class="work-row" routerLink="/quartos"
                  ><span class="row-indicator home-badge green"
                    ><span class="material-symbols-outlined" aria-hidden="true"
                      >meeting_room</span
                    ></span
                  ><span
                    ><strong>Mapa de quartos</strong
                    ><small>Blocos, pisos e ocupação em um só lugar.</small></span
                  ><span class="row-tail"
                    >Abrir mapa
                    <span class="material-symbols-outlined" aria-hidden="true"
                      >arrow_forward</span
                    ></span
                  ></a
                ><a class="work-row" routerLink="/supervisores"
                  ><span class="row-indicator home-badge blue"
                    ><span class="material-symbols-outlined" aria-hidden="true">groups</span></span
                  ><span
                    ><strong>Supervisores</strong><small>Consulte e organize a equipe.</small></span
                  ><span class="row-tail"
                    >Ver equipe
                    <span class="material-symbols-outlined" aria-hidden="true"
                      >arrow_forward</span
                    ></span
                  ></a
                ><a class="work-row" routerLink="/relatorios"
                  ><span class="row-indicator home-badge amber"
                    ><span class="material-symbols-outlined" aria-hidden="true"
                      >monitoring</span
                    ></span
                  ><span
                    ><strong>Relatórios</strong
                    ><small>Escolha o tipo e o período. Dados de demonstração.</small></span
                  ><span class="row-tail"
                    >Gerar relatório
                    <span class="material-symbols-outlined" aria-hidden="true"
                      >arrow_forward</span
                    ></span
                  ></a
                >
              </section>
            </section>
            <aside class="home-aside">
              <section class="aside-block">
                <h2>Antes de continuar</h2>
                <p>
                  Este ambiente permite experimentar jornadas e revisão de cadastros com dados
                  fictícios.
                </p>
                <a routerLink="/ajuda"
                  >Entenda o protótipo
                  <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></a
                >
              </section>
            </aside>
          </div>
        } @else {
          <div class="home-columns">
            <section class="home-main">
              <div class="feature-task home-hero">
                <div class="task-icon">
                  <span class="material-symbols-outlined home-hero-icon" aria-hidden="true"
                    >outbound</span
                  >
                </div>
                <div>
                  <span class="eyebrow">Meu espaço</span>
                  <h2>Minhas saídas</h2>
                  <p>Solicite uma saída curta ou longa e acompanhe cada etapa com clareza.</p>
                </div>
                <a class="btn" routerLink="/saidas">Ver minhas saídas</a>
              </div>
              <section class="work-list">
                <div class="section-heading">
                  <h2>Para acompanhar</h2>
                  <span>Somente suas informações</span>
                </div>
                <a class="work-row" routerLink="/avisos"
                  ><span class="row-indicator home-badge amber"
                    ><span class="material-symbols-outlined" aria-hidden="true"
                      >campaign</span
                    ></span
                  ><span
                    ><strong>Avisos e advertências</strong
                    ><small>A leitura e a ciência são etapas distintas.</small></span
                  ><span class="row-tail"
                    >Consultar
                    <span class="material-symbols-outlined" aria-hidden="true"
                      >arrow_forward</span
                    ></span
                  ></a
                ><a class="work-row" routerLink="/ranking"
                  ><span class="row-indicator home-badge green"
                    ><span class="material-symbols-outlined" aria-hidden="true"
                      >leaderboard</span
                    ></span
                  ><span
                    ><strong>Ranking dos quartos</strong
                    ><small>Veja a classificação por período.</small></span
                  ><span class="row-tail"
                    >Ver ranking
                    <span class="material-symbols-outlined" aria-hidden="true"
                      >arrow_forward</span
                    ></span
                  ></a
                >
              </section>
            </section>
            <aside class="home-aside">
              <section class="aside-block">
                <h2>Precisa de orientação?</h2>
                <p>A ajuda explica cada passo e quem confirma as solicitações.</p>
                <a routerLink="/ajuda"
                  >Abrir ajuda
                  <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></a
                >
              </section>
            </aside>
          </div>
        }
      </main>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .home-heading {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        flex-wrap: wrap;
        gap: 16px 24px;
        margin-bottom: 28px;
      }
      .home-heading h1 {
        margin: 8px 0;
      }
      .home-heading p {
        margin: 0;
        font-size: 1.1rem;
        color: var(--muted);
      }
      .home-columns {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 300px;
        gap: 24px;
      }
      .home-main {
        min-width: 0;
      }
      .feature-task {
        display: grid;
        grid-template-columns: 48px minmax(0, 1fr) auto;
        align-items: center;
        gap: 16px 28px;
      }
      .feature-task h2 {
        margin: 4px 0;
      }
      .feature-task p {
        margin: 0;
        max-width: 620px;
      }
      .feature-task .eyebrow,
      .task-time {
        color: var(--green-100);
      }
      .task-time {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
        font-size: var(--text-meta);
      }
      .work-list {
        margin-top: 28px;
      }
      .section-heading {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 8px 16px;
        padding-bottom: 16px;
      }
      .section-heading h2 {
        margin: 0;
        font-size: 1.4rem;
      }
      .section-heading > span {
        font-size: var(--text-meta);
        color: var(--muted);
      }
      .work-row {
        display: grid;
        grid-template-columns: 56px minmax(0, 1.4fr) minmax(150px, 0.7fr) auto;
        align-items: center;
        gap: 16px 24px;
        padding: 20px 0;
        border-top: 1px solid var(--line);
        color: var(--ink);
        text-decoration: none;
      }
      .work-row:last-child {
        border-bottom: 1px solid var(--line);
      }
      .work-row strong,
      .work-row small {
        display: block;
      }
      .work-row strong {
        font-size: 1.1rem;
      }
      .work-row small {
        margin-top: 4px;
        font-size: var(--text-meta);
        line-height: 1.4;
        color: var(--muted);
      }
      .row-copy,
      .row-status {
        min-width: 0;
      }
      .row-status {
        padding-left: 20px;
        border-left: 1px solid var(--line);
      }
      .row-status strong {
        font-size: 1rem;
      }
      .row-indicator.amber {
        background: var(--warning-bg);
        color: var(--warning);
      }
      .row-indicator.blue {
        background: var(--info-bg);
        color: var(--info);
      }
      .row-indicator.green {
        background: var(--green-100);
        color: var(--green-900);
      }
      .row-tail {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 48px;
        padding: 0 20px;
        border-radius: var(--radius-control);
        background: var(--green-900);
        color: #fff;
        font-weight: 700;
        white-space: nowrap;
      }
      .work-row:hover .row-tail {
        background: var(--green-950);
      }
      .home-aside {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .aside-block {
        padding: 24px;
        border: 1px solid var(--line);
        border-radius: var(--radius-card);
        background: #fff;
        box-shadow: var(--shadow);
      }
      .aside-block:last-child {
        border-color: var(--success-line);
        background: var(--green-50);
        box-shadow: none;
      }
      .aside-block h2 {
        margin: 0 0 16px;
        font-size: 1.15rem;
      }
      .aside-block p {
        margin: 12px 0 0;
        font-size: var(--text-meta);
        color: var(--muted);
      }
      .aside-block a {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        margin-top: 8px;
        font-weight: 700;
        text-decoration: none;
      }
      .aside-block a:hover {
        text-decoration: underline;
      }
      .agenda-line {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid var(--line);
      }
      .agenda-line strong {
        color: var(--green-800);
      }
      @media (max-width: 1300px) {
        .work-row {
          grid-template-columns: 56px minmax(0, 1fr) auto;
        }
        .row-status {
          grid-column: 2;
          grid-row: 2;
          padding-left: 0;
          border-left: 0;
        }
        .row-tail {
          grid-column: 3;
          grid-row: 1/3;
        }
      }
      @media (max-width: 1100px) {
        .home-columns {
          grid-template-columns: 1fr;
        }
        .home-aside {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 760px) {
        .feature-task {
          grid-template-columns: 48px 1fr;
        }
        .feature-task .btn {
          grid-column: 1/-1;
        }
        .work-row {
          grid-template-columns: 48px minmax(0, 1fr);
          gap: 12px;
        }
        .row-indicator {
          width: 48px;
          height: 48px;
        }
        .row-status,
        .row-tail {
          grid-column: 2;
          grid-row: auto;
        }
        .row-tail {
          justify-self: start;
        }
        .home-aside {
          grid-template-columns: 1fr;
        }
        .aside-block {
          padding: 18px;
        }
      }
    `,
  ],
})
export class HomePage {
  readonly session = inject(DemoSessionService);
  private readonly operations = inject(OperationsDemoService);
  readonly countsAvailable = computed(() => this.session.scenario() === 'padrao');
  readonly pendingExitCount = computed(
    () =>
      this.operations
        .exits()
        .filter(
          (request) =>
            request.status === 'Aguardando análise' && (request.kind === 'Curta' || request.signed),
        ).length,
  );
  readonly shortReturnCount = computed(
    () =>
      this.operations
        .exits()
        .filter((request) => request.kind === 'Curta' && request.status === 'Em andamento').length,
  );
  readonly notificationCount = computed(
    () =>
      this.operations
        .notifications()
        .filter((notification) =>
          ['Pendente', 'Visualizada', 'Em análise'].includes(notification.status),
        ).length,
  );
  readonly pendingExitStatus = computed(() =>
    this.pendingExitCount() ? 'Aguardando análise' : 'Nenhuma aguardando análise',
  );
  readonly shortReturnStatus = computed(() =>
    this.shortReturnCount() ? 'Em andamento' : 'Nenhum retorno em andamento',
  );
  readonly notificationStatus = computed(() =>
    this.notificationCount() ? 'Aguardando decisão' : 'Nenhuma aguardando decisão',
  );
  readonly heading = computed(() =>
    this.session.role() === 'gestor'
      ? 'Olá, gestor'
      : this.session.role() === 'residente'
        ? 'Olá, residente'
        : 'Olá, supervisora',
  );
  readonly intro = computed(() =>
    this.session.role() === 'gestor'
      ? 'Acompanhe cadastros e informações da residência.'
      : this.session.role() === 'residente'
        ? 'Acompanhe o que precisa da sua atenção.'
        : 'Veja o que precisa da sua atenção hoje.',
  );
}

@Component({
  standalone: true,
  selector: 'sager-help',
  imports: [RouterLink],
  template: `
    <main class="page content-page">
      <header class="page-header">
        <div>
          <h1>Ajuda e perguntas frequentes</h1>
          <p>Encontre orientações para as tarefas mais comuns.</p>
        </div>
      </header>
      <section class="help-intro panel">
        <div><span class="material-symbols-outlined" aria-hidden="true">support_agent</span></div>
        <div>
          @if (session.active()) {
            <h2>Como usar esta demonstração</h2>
            <p>
              Escolha um perfil para navegar. As informações das telas são fictícias e as ações
              ficam apenas nesta sessão.
            </p>
            <a routerLink="/demonstracao">Escolher perfil de demonstração</a>
          } @else {
            <h2>Usar sua conta SAGER</h2>
            <p>
              Entre com sua matrícula e a senha do SAGER. O que aparece na tela depende da sua
              função. Confira os dados antes de confirmar.
            </p>
            <a routerLink="/perfil">Ver meu perfil</a>
          }
        </div>
      </section>
      <h2>Guias por tarefa</h2>
      <div class="guide-grid">
        @if (session.hasRole('supervisor')) {
          <a routerLink="/chamada"
            ><span class="material-symbols-outlined" aria-hidden="true">fact_check</span
            ><strong>Fazer a chamada</strong><span>Marque, revise e confirme a presença.</span></a
          >
        }
        @if (session.hasRole('supervisor', 'residente')) {
          <a routerLink="/saidas"
            ><span class="material-symbols-outlined" aria-hidden="true">directions_walk</span
            ><strong>Acompanhar saídas</strong
            ><span>Entenda análise, autorização e retorno.</span></a
          >
          <a
            [routerLink]="
              session.role() === 'residente' || session.active()
                ? '/avisos'
                : '/comunicacoes/avisos'
            "
            ><span class="material-symbols-outlined" aria-hidden="true">campaign</span
            ><strong>Comunicações</strong><span>Veja e confirme seus avisos.</span></a
          >
        }
        @if (session.hasRole('gestor', 'supervisor')) {
          <a routerLink="/relatorios"
            ><span class="material-symbols-outlined" aria-hidden="true">monitoring</span
            ><strong>Gerar relatório</strong><span>Escolha o relatório e as datas.</span></a
          >
        }
        @if (session.hasRole('residente')) {
          <a [routerLink]="session.active() ? '/ranking' : '/minha-limpeza'"
            ><span class="material-symbols-outlined" aria-hidden="true">cleaning_services</span
            ><strong>Minha limpeza</strong><span>Veja as notas e a posição do quarto.</span></a
          >
        }
      </div>
      <section class="faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Perguntas frequentes</h2>
        @if (session.active()) {
          <details>
            <summary>Esta demonstração usa dados reais?</summary>
            <p>
              Não. Todos os nomes e registros apresentados são sintéticos. As alterações não são
              enviadas a serviços externos.
            </p>
          </details>
        } @else {
          <details>
            <summary>Como recuperar ou alterar minha senha?</summary>
            <p>
              Residente: na tela de acesso, clique em
              <a routerLink="/recuperar-senha">Esqueci minha senha</a>, informe matrícula, nome
              completo, data de nascimento e, se houver, o nome do responsável, e crie a senha nova.
            </p>
            <p>
              Gestor ou supervisor: procure o suporte da instituição, que confere quem você é e
              troca sua senha.
            </p>
          </details>
        }
        <details>
          <summary>Quem confirma o retorno de uma saída curta?</summary>
          <p>O supervisor registra a volta depois de ver o residente chegar.</p>
        </details>
        <details>
          <summary>A saída longa pode ser aprovada antes da autorização?</summary>
          <p>
            Não. Um servidor precisa conferir a autorização do responsável antes da aprovação.
            @if (session.active()) {
              Nesta demonstração, o arquivo e a conferência são simulados, sem validade jurídica.
            } @else {
              Se o WhatsApp não estiver funcionando, o supervisor anexa o arquivo recebido por outro
              meio. Mensagem entregue não confirma a autorização nem a saída.
            }
          </p>
        </details>
        <details>
          <summary>Uma notificação vira advertência sozinha?</summary>
          <p>Não. O supervisor vê o que aconteceu e decide se arquiva ou dá uma advertência.</p>
        </details>
        <details>
          <summary>Abrir um aviso já conta como “Estou ciente”?</summary>
          <p>Não. Você precisa clicar no botão “Estou ciente” e confirmar.</p>
        </details>
        <details>
          <summary>Como são calculados o ranking e os relatórios?</summary>
          <p>
            @if (session.active()) {
              Os números da demonstração são sintéticos.
            } @else {
              A nota de limpeza é a média dos quatro itens. Quartos com a mesma média ficam na mesma
              posição. A tela e os arquivos mostram os mesmos dados.
            }
          </p>
        </details>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .content-page {
        max-width: var(--content-narrow);
      }
      .help-intro {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        margin: 24px 0 32px;
        padding: 16px 18px;
        border: 1px solid var(--success-line);
        border-radius: 12px;
        background: var(--green-50);
        box-shadow: none;
        color: var(--green-950);
      }
      .help-intro h2 {
        margin: 0 0 6px;
        font-size: 1.15rem;
      }
      .help-intro p {
        margin: 0 0 4px;
      }
      .help-intro a {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        font-weight: 700;
      }
      h2 {
        font-size: 1.4rem;
      }
      .guide-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
        gap: 24px;
        margin: 16px 0 32px;
      }
      .guide-grid a {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 24px;
        border: 1px solid var(--line);
        border-radius: var(--radius-card);
        background: #fff;
        box-shadow: var(--shadow);
        color: var(--ink);
        text-decoration: none;
      }
      .guide-grid a:hover {
        border-color: var(--green-800);
      }
      .guide-grid .material-symbols-outlined {
        color: var(--green-900);
      }
      .guide-grid span:last-child {
        font-size: var(--text-meta);
        color: var(--muted);
      }
      .faq {
        padding: 24px;
        border: 1px solid var(--line);
        border-radius: var(--radius-card);
        background: #fff;
        box-shadow: var(--shadow);
      }
      .faq h2 {
        margin: 0 0 8px;
        font-size: 1.2rem;
      }
      .faq details {
        border-top: 1px solid var(--line);
      }
      .faq summary {
        min-height: 48px;
        padding: 12px 0;
        font-weight: 700;
        cursor: pointer;
      }
      .faq p {
        margin: 0;
        padding: 0 0 16px;
        color: var(--muted);
        line-height: 1.6;
      }
      @media (max-width: 760px) {
        .guide-grid a,
        .faq {
          padding: 18px;
        }
      }
    `,
  ],
})
export class HelpPage {
  readonly session = inject(DemoSessionService);
}

@Component({
  standalone: true,
  selector: 'sager-profile',
  imports: [RouterLink],
  template: `<main class="page simple-page">
    <header class="page-header">
      <div>
        <h1>Meu perfil</h1>
        <p>
          {{
            session.active()
              ? 'Conta de demonstração'
              : session.production
                ? 'Conta do SAGER'
                : 'Conta local de desenvolvimento'
          }}
        </p>
      </div>
    </header>
    <section class="panel profile-panel">
      <div class="profile-avatar">
        <span class="material-symbols-outlined" aria-hidden="true">person</span>
      </div>
      <div>
        <strong>{{ session.active() ? label() : auth.principal()?.nome }}</strong
        ><span>{{
          session.active() ? 'IF Goiano · Campus Urutaí' : auth.principal()?.matricula
        }}</span>
        @if (session.active()) {
          <small>Dados fictícios da demonstração</small>
        } @else {
          <small>Perfil da conta: {{ localRoleLabel() }}</small>
        }
      </div>
    </section>
    @if (!session.active()) {
      <section class="profile-link" aria-labelledby="profile-link-title">
        <h2 id="profile-link-title">Seu cadastro</h2>
        @if (auth.principal()?.residenteId) {
          <p>Sua conta está ligada ao seu cadastro de residente.</p>
        } @else if (auth.principal()?.supervisorId) {
          <p>Sua conta está ligada ao seu cadastro de supervisor.</p>
        } @else {
          <p>Sua conta ainda não está ligada a um cadastro.</p>
          <p>Peça ao suporte para ligar sua conta ao cadastro.</p>
        }
      </section>
    }
    <div class="action-row">
      @if (session.active()) {
        <a class="btn-secondary" routerLink="/demonstracao">Trocar perfil</a>
      }
      <a class="btn" routerLink="/inicio">Voltar ao início</a>
    </div>
  </main>`,
  styles: [
    `
      :host {
        display: block;
      }
      .simple-page {
        max-width: 900px;
      }
      .profile-panel {
        display: flex;
        align-items: center;
        gap: 22px;
        margin: 24px 0;
        padding: 24px;
        box-shadow: var(--shadow);
      }
      .profile-avatar {
        flex-shrink: 0;
        display: grid;
        place-items: center;
        width: 72px;
        height: 72px;
        border-radius: 50%;
        background: var(--green-100);
        color: var(--green-900);
      }
      .profile-avatar .material-symbols-outlined {
        font-size: 40px;
      }
      .profile-panel strong,
      .profile-panel span,
      .profile-panel small {
        display: block;
      }
      .profile-panel strong {
        font-size: 1.25rem;
      }
      .profile-panel span {
        margin: 4px 0;
        font-weight: 600;
      }
      .profile-panel small {
        font-size: var(--text-meta);
        color: var(--muted);
      }
      .profile-panel > div:last-child {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .profile-link {
        padding-block: 4px 24px;
      }
      .profile-link h2 {
        margin: 0 0 12px;
        font-size: 1.2rem;
      }
      .profile-link summary {
        display: list-item;
        align-content: center;
        min-height: 44px;
        color: var(--green-800);
        font-weight: 600;
        cursor: pointer;
      }
      .profile-link code {
        display: block;
        padding-block: 8px;
        overflow-wrap: anywhere;
      }
      @media (max-width: 520px) {
        .profile-panel {
          align-items: flex-start;
          gap: 16px;
          padding: 18px;
        }
        .profile-avatar {
          width: 48px;
          height: 48px;
        }
        .profile-avatar .material-symbols-outlined {
          font-size: 28px;
        }
      }
    `,
  ],
})
export class ProfilePage {
  readonly session = inject(DemoSessionService);
  readonly auth = inject(LocalAuthService);
  readonly localRoleLabel = computed(
    () =>
      ({ gestor: 'Gestor', supervisor: 'Supervisor', residente: 'Residente' })[
        this.auth.principal()?.perfis[0] ?? 'residente'
      ],
  );
  readonly label = computed(
    () =>
      ({
        gestor: 'Gestor da Assistência Estudantil',
        supervisor: 'Supervisor da residência',
        residente: 'Residente',
      })[this.session.role()],
  );
}

const statusPageStyles = `
  :host {
    display: block;
  }
  .status-page {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 18px;
    width: min(100% - 32px, 560px);
    margin: 7vh auto;
    padding: 40px;
    border: 1px solid var(--line);
    border-radius: var(--radius-card);
    background: #fff;
    box-shadow: var(--shadow);
  }
  .status-page > .material-symbols-outlined {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--green-100);
    color: var(--green-900);
  }
  .status-page.denied > .material-symbols-outlined {
    background: var(--warning-bg);
    color: var(--warning);
  }
  h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 800;
    line-height: 1.15;
  }
  p {
    margin: 0;
    font-size: 1.05rem;
    color: var(--muted);
  }
  @media (max-width: 520px) {
    .status-page {
      padding: 24px 18px;
    }
    h1 {
      font-size: 1.6rem;
    }
  }
`;

@Component({
  standalone: true,
  selector: 'sager-denied',
  imports: [RouterLink],
  template: `<main class="page status-page denied">
    <span class="material-symbols-outlined" aria-hidden="true">lock</span>
    <h1>Acesso não disponível para este perfil</h1>
    <p>
      {{
        session.active()
          ? 'Esta área pertence a outra jornada da demonstração. Escolha um perfil compatível para continuar.'
          : 'O perfil da sua conta não permite esta área.'
      }}
    </p>
    <div class="action-row">
      @if (session.active()) {
        <a class="btn" routerLink="/demonstracao">Escolher outro perfil</a>
      }
      <a class="btn-secondary" routerLink="/inicio">Voltar ao início</a>
    </div>
  </main>`,
  styles: [statusPageStyles],
})
export class DeniedPage {
  readonly session = inject(DemoSessionService);
}

@Component({
  standalone: true,
  selector: 'sager-not-found',
  imports: [RouterLink],
  template: `<main class="page status-page">
    <span class="material-symbols-outlined" aria-hidden="true">search_off</span>
    <h1>Página não encontrada</h1>
    <p>O endereço pode ter mudado ou foi digitado incorretamente.</p>
    <a class="btn" routerLink="/inicio">Ir para o início</a>
  </main>`,
  styles: [statusPageStyles],
})
export class NotFoundPage {}
