import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { LocalAuthService } from '../../core/local-auth.service';
import { OperationsDemoService } from '../operations/operations-demo.service';

@Component({
  standalone: true,
  selector: 'sager-access',
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    <main class="access-layout">
      <section class="access-intro" aria-labelledby="access-title">
        <img
          src="/if-goiano-urutai.png"
          alt="Instituto Federal Goiano, Campus Urutaí"
          class="access-logo"
        />
        <span class="eyebrow">Assistência Estudantil · Campus Urutaí</span>
        <h1 id="access-title">A rotina da residência, mais clara para todos.</h1>
        <p>O SAGER organiza chamada, saídas, quartos e comunicações em um único lugar.</p>
        <div class="access-facts">
          <span>Informações no momento certo</span><span>Decisões com revisão</span
          ><span>Histórico fácil de consultar</span>
        </div>
      </section>
      <section class="access-card" aria-labelledby="access-card-title">
        <span class="demo-label">Acesso local · desenvolvimento e testes</span>
        <h2 id="access-card-title">Acessar o SAGER</h2>
        <p>
          Entre com a conta local fornecida pelo operador. As telas ainda mostram dados fictícios.
        </p>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label for="login-email">E-mail</label>
          <input
            id="login-email"
            type="email"
            formControlName="email"
            autocomplete="username"
            required
          />
          <label for="login-password">Senha</label>
          <input
            id="login-password"
            type="password"
            formControlName="password"
            autocomplete="current-password"
            required
          />
          @if (error()) {
            <p class="login-error" role="alert">{{ error() }}</p>
          }
          <button class="btn" type="submit" [disabled]="busy()">
            {{ busy() ? 'Entrando...' : 'Entrar com e-mail e senha' }}
          </button>
        </form>
        <div class="access-divider"><span>ou</span></div>
        <p class="demo-intro">
          Explore as telas sem conta. A demonstração é pública e usa somente exemplos fictícios.
        </p>
        <a class="btn" routerLink="/demonstracao"
          ><span class="material-symbols-outlined" aria-hidden="true">explore</span>Explorar
          demonstração</a
        >
        <div class="access-support">
          <a routerLink="/ajuda">Como funciona a demonstração</a
          ><span>Autenticação institucional a definir</span>
        </div>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: #f1f5f0;
      }
      .access-layout {
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(360px, 0.9fr);
      }
      .access-intro {
        background: #113f2b;
        color: #fff;
        padding: clamp(32px, 7vw, 104px);
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .access-logo {
        width: min(290px, 80%);
        height: auto;
        object-fit: contain;
        background: #fff;
        border-radius: 10px;
        padding: 16px;
        margin-bottom: clamp(36px, 7vw, 80px);
      }
      .eyebrow {
        font-size: 0.88rem;
        font-weight: 700;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: #bde1c4;
      }
      .access-intro h1 {
        font-size: clamp(2.5rem, 4.5vw, 4.7rem);
        line-height: 1.08;
        letter-spacing: -0.04em;
        max-width: 720px;
        margin: 20px 0;
      }
      .access-intro p {
        font-size: 1.25rem;
        max-width: 540px;
        line-height: 1.55;
        color: #e3efe6;
      }
      .access-facts {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 38px;
      }
      .access-facts span {
        border: 1px solid #739b80;
        border-radius: 100px;
        padding: 8px 14px;
        font-size: 0.88rem;
      }
      .access-card {
        align-self: center;
        justify-self: center;
        background: #fff;
        border: 1px solid #dbe5dc;
        box-shadow: 0 12px 36px #153e1a12;
        border-radius: 18px;
        padding: clamp(28px, 4vw, 52px);
        width: min(510px, calc(100% - 48px));
      }
      .demo-label {
        color: #135e3b;
        background: #e9f4ec;
        border-radius: 5px;
        padding: 7px 11px;
        font-weight: 700;
        font-size: 0.82rem;
      }
      .access-card h2 {
        font-size: 2rem;
        line-height: 1.2;
        margin: 26px 0 12px;
      }
      .access-card p {
        color: #425449;
        font-size: 1.06rem;
        line-height: 1.55;
        margin-bottom: 20px;
      }
      .access-card form {
        display: grid;
        gap: 8px;
      }
      .access-card label {
        font-weight: 700;
        color: #263d2c;
      }
      .access-card input {
        width: 100%;
        min-height: 44px;
        border: 1px solid #9cad9e;
        border-radius: 7px;
        padding: 9px 12px;
        font: inherit;
        margin-bottom: 8px;
      }
      .access-card input:focus-visible {
        outline: 3px solid #a45c00;
        outline-offset: 2px;
      }
      .access-card .btn {
        width: 100%;
        justify-content: center;
        cursor: pointer;
      }
      .access-card .btn:disabled {
        opacity: 0.7;
        cursor: wait;
      }
      .access-card .login-error {
        color: #9a251b;
        font-weight: 700;
        margin: 0 0 8px;
        font-size: 0.92rem;
      }
      .access-divider {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 22px 0;
        color: #536359;
      }
      .access-divider::before,
      .access-divider::after {
        content: '';
        flex: 1;
        border-top: 1px solid #dbe5dc;
      }
      .access-card .demo-intro {
        font-size: 0.94rem;
        margin-bottom: 16px;
      }
      .access-support {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-top: 26px;
        font-size: 0.9rem;
        color: #526158;
      }
      .access-support a {
        color: #125537;
        font-weight: 700;
      }
      @media (max-width: 820px) {
        .access-layout {
          grid-template-columns: 1fr;
        }
        .access-intro {
          padding: 32px 24px 40px;
        }
        .access-logo {
          width: 200px;
          margin-bottom: 30px;
        }
        .access-intro h1 {
          font-size: 2.5rem;
        }
        .access-facts {
          margin-top: 14px;
        }
        .access-card {
          margin: 24px auto 40px;
        }
      }
    `,
  ],
})
export class AccessPage {
  private readonly auth = inject(LocalAuthService);
  private readonly session = inject(DemoSessionService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  async submit(): Promise<void> {
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Informe um e-mail válido e a senha.');
      return;
    }
    this.busy.set(true);
    try {
      const result = await this.auth.login(
        this.form.controls.email.value.trim(),
        this.form.controls.password.value,
      );
      if (result === 'invalid') {
        this.error.set('E-mail ou senha inválidos, ou conta desativada.');
        return;
      }
      this.session.deactivate();
      this.form.controls.password.reset();
      await this.router.navigateByUrl('/inicio');
    } catch {
      this.error.set('O login local está indisponível. Você ainda pode explorar a demonstração.');
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  standalone: true,
  selector: 'sager-demo-selector',
  imports: [],
  template: `
    <main class="page demo-choice">
      <div class="page-header">
        <div>
          <span class="eyebrow">Primeiro acesso</span>
          <h1>Escolha uma experiência</h1>
          <p>Os perfis usam exemplos fictícios para mostrar cada jornada.</p>
        </div>
      </div>
      <div class="role-grid" [attr.aria-busy]="busy()">
        @for (option of options; track option.role) {
          <button type="button" class="role-card" [disabled]="busy()" (click)="choose(option.role)">
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
      @if (error()) {
        <p class="demo-error" role="alert">{{ error() }}</p>
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
      .eyebrow {
        font-size: 0.83rem;
        text-transform: uppercase;
        letter-spacing: 0.09em;
        color: #17683f;
        font-weight: 800;
      }
      .role-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 20px;
        margin: 32px 0;
      }
      .role-card {
        text-align: left;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        min-height: 300px;
        padding: 28px;
        border-radius: 16px;
        background: #fff;
        border: 1px solid #d7e2da;
        cursor: pointer;
        color: #233b2c;
        box-shadow: 0 6px 24px #113f2b0a;
      }
      .role-card:hover {
        border-color: #318757;
        box-shadow: 0 10px 28px #113f2b1e;
      }
      .role-card:disabled {
        opacity: 0.7;
        cursor: wait;
      }
      .role-card:focus-visible {
        outline: 3px solid #a45c00;
        outline-offset: 3px;
      }
      .role-card > .material-symbols-outlined {
        font-size: 34px;
        background: #e8f2e9;
        color: #17583a;
        padding: 12px;
        border-radius: 12px;
      }
      .role-card strong {
        font-size: 1.3rem;
      }
      .role-card > span:not(.material-symbols-outlined):not(.role-action) {
        line-height: 1.5;
        color: #536359;
      }
      .role-action {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #0f5735;
        font-weight: 800;
        margin-top: auto;
      }
      .demo-note {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        color: #536359;
        line-height: 1.5;
      }
      .demo-error {
        color: #9a251b;
        font-weight: 700;
      }
      @media (max-width: 760px) {
        .role-grid {
          grid-template-columns: 1fr;
        }
        .role-card {
          min-height: 220px;
        }
      }
    `,
  ],
})
export class DemoSelectorPage {
  private readonly session = inject(DemoSessionService);
  private readonly auth = inject(LocalAuthService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly options = [
    {
      role: 'supervisor' as const,
      icon: 'assignment_turned_in',
      title: 'Supervisor',
      description: 'Chamada, saídas, retornos, notificações e limpeza.',
    },
    {
      role: 'gestor' as const,
      icon: 'apartment',
      title: 'Gestor',
      description: 'Cadastros, quartos, acompanhamento e relatórios.',
    },
    {
      role: 'residente' as const,
      icon: 'home',
      title: 'Residente',
      description: 'Minhas saídas, avisos, advertências e ranking.',
    },
  ];
  async choose(role: 'gestor' | 'supervisor' | 'residente'): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      // Revalida o cookie: numa aba nova ainda não existe principal em memória.
      if (await this.auth.refresh()) {
        try {
          await this.auth.logout();
        } catch {
          this.error.set('Não foi possível encerrar a sessão local. Tente novamente.');
          return;
        }
      }
      this.session.activate(role);
      await this.router.navigateByUrl('/inicio');
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  standalone: true,
  selector: 'sager-home',
  imports: [RouterLink],
  template: `
    <main class="page home-page">
      <header class="home-heading">
        <div>
          <span class="eyebrow">SAGER · Campus Urutaí</span>
          <h1>{{ heading() }}</h1>
          <p>{{ intro() }}</p>
        </div>
        <span class="demo-pill">Dados fictícios</span>
      </header>
      @if (session.role() === 'supervisor') {
        <div class="home-columns">
          <section class="home-main">
            <div class="feature-task">
              <div class="task-icon">
                <span class="material-symbols-outlined" aria-hidden="true">fact_check</span>
              </div>
              <div>
                <span class="overline">Próxima atividade</span>
                <h2>Chamada noturna</h2>
                <p>
                  Confira a presença dos residentes menores de idade e revise as marcações antes de
                  registrar.
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
                ><span class="row-indicator amber"
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
                      ? 'Saídas longas exigem assinatura prévia.'
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
                ><span class="row-indicator blue"
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
                ><span class="row-indicator green"
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
            <div class="feature-task">
              <div class="task-icon">
                <span class="material-symbols-outlined" aria-hidden="true">apartment</span>
              </div>
              <div>
                <span class="overline">Visão da residência</span>
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
                ><span class="row-indicator green"
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
                ><span class="row-indicator blue"
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
                ><span class="row-indicator amber"
                  ><span class="material-symbols-outlined" aria-hidden="true"
                    >monitoring</span
                  ></span
                ><span
                  ><strong>Relatórios</strong
                  ><small>Combine filtros e consulte dados de demonstração.</small></span
                ><span class="row-tail"
                  >Ver relatórios
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
      } @else if (session.role() === 'saude') {
        <section class="feature-task" aria-labelledby="health-home-title">
          <div class="task-icon">
            <span class="material-symbols-outlined" aria-hidden="true">health_and_safety</span>
          </div>
          <div>
            <h2 id="health-home-title">Atendimento de saúde</h2>
            <p>
              Consulte os residentes assistidos e os registros que você está autorizado a acessar.
            </p>
          </div>
          <a class="btn" routerLink="/saude">Abrir área de saúde</a>
        </section>
      } @else {
        <div class="home-columns">
          <section class="home-main">
            <div class="feature-task">
              <div class="task-icon">
                <span class="material-symbols-outlined" aria-hidden="true">outbound</span>
              </div>
              <div>
                <span class="overline">Meu espaço</span>
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
                ><span class="row-indicator amber"
                  ><span class="material-symbols-outlined" aria-hidden="true">campaign</span></span
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
                ><span class="row-indicator green"
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
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .home-page {
        max-width: 1540px;
        margin: auto;
      }
      .home-heading {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: flex-start;
        margin-bottom: 26px;
      }
      .eyebrow,
      .overline {
        font-size: 0.88rem;
        font-weight: 800;
        color: #196f46;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .home-heading h1 {
        font-size: clamp(2rem, 3vw, 2.7rem);
        letter-spacing: -0.03em;
        margin: 8px 0;
      }
      .home-heading p {
        color: #526258;
        font-size: 1.05rem;
        margin: 0;
      }
      .demo-pill {
        background: #e9f2e8;
        color: #145837;
        border: 1px solid #cce0cf;
        padding: 8px 13px;
        border-radius: 100px;
        font-size: 0.88rem;
        font-weight: 800;
        white-space: nowrap;
      }
      .home-columns {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 286px;
        gap: 24px;
      }
      .home-main {
        min-width: 0;
      }
      .feature-task {
        background: #0c4837;
        color: #fff;
        border-radius: 15px;
        padding: 28px;
        display: grid;
        grid-template-columns: 60px minmax(0, 1fr) auto;
        align-items: center;
        gap: 20px;
        box-shadow: 0 8px 28px #2145270b;
      }
      .task-icon {
        background: #e7f2e8;
        color: #14633d;
        width: 58px;
        height: 58px;
        display: grid;
        place-items: center;
        border-radius: 12px;
      }
      .feature-task p {
        color: #e7f3ea;
        margin: 0;
        line-height: 1.5;
        max-width: 620px;
      }
      .task-time {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: #d4ead9;
        font-size: 0.9rem;
        margin-top: 11px;
      }
      .feature-task .overline {
        color: #c8e8d0;
      }
      .feature-task .btn {
        background: #fff;
        border-color: #fff;
        color: #0c4837;
      }
      .feature-task .btn:hover {
        background: #eef6ef;
        color: #0c4837;
        border-color: #eef6ef;
      }
      .work-list {
        background: #fff;
        border: 1px solid #d7e3d8;
        border-radius: 15px;
        margin-top: 22px;
        overflow: hidden;
      }
      .section-heading {
        padding: 22px 26px;
        display: flex;
        justify-content: space-between;
        gap: 15px;
        align-items: baseline;
        border-bottom: 1px solid #e7ede8;
      }
      .section-heading h2 {
        margin: 0;
        font-size: 1.27rem;
      }
      .section-heading > span {
        color: #5a6b5f;
        font-size: 0.9rem;
      }
      .work-row {
        display: grid;
        grid-template-columns: 48px minmax(0, 1.4fr) minmax(150px, 0.7fr) auto;
        gap: 18px;
        align-items: center;
        padding: 20px 26px;
        text-decoration: none;
        color: #203a29;
        min-height: 104px;
      }
      .work-row + .work-row {
        border-top: 1px solid #e7ede8;
      }
      .work-row:hover {
        background: #f4f9f5;
      }
      .work-row strong,
      .work-row small {
        display: block;
      }
      .work-row strong {
        font-size: 1.03rem;
      }
      .work-row small {
        color: #536458;
        font-size: 0.9rem;
        margin-top: 4px;
        line-height: 1.4;
      }
      .row-copy,
      .row-status {
        min-width: 0;
      }
      .row-status {
        border-left: 1px solid #dce6de;
        padding-left: 18px;
      }
      .row-status strong {
        font-size: 0.9rem;
      }
      .row-status small {
        font-size: 0.85rem;
      }
      .row-indicator {
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: 10px;
      }
      .row-indicator.amber {
        background: #fff1d8;
        color: #88510a;
      }
      .row-indicator.blue {
        background: #e5f0f4;
        color: #1c6376;
      }
      .row-indicator.green {
        background: #e8f2e9;
        color: #17683f;
      }
      .row-tail {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #125b39;
        font-size: 0.9rem;
        font-weight: 800;
        white-space: nowrap;
      }
      .home-aside {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .aside-block {
        background: #fff;
        border: 1px solid #d7e3d8;
        border-radius: 15px;
        padding: 24px;
      }
      .aside-block h2 {
        font-size: 1.1rem;
        margin: 0 0 18px;
      }
      .aside-block p {
        font-size: 0.9rem;
        line-height: 1.5;
        color: #58675b;
        margin: 15px 0 0;
      }
      .aside-block a {
        display: inline-flex;
        align-items: center;
        color: #135f3a;
        font-weight: 800;
        margin-top: 12px;
        min-height: 44px;
      }
      .agenda-line {
        display: flex;
        align-items: center;
        gap: 13px;
        border-bottom: 1px solid #dbe6dc;
        padding: 8px 0;
      }
      .agenda-line strong {
        color: #175d3b;
      }
      @media (max-width: 1300px) {
        .work-row {
          grid-template-columns: 44px minmax(0, 1fr) auto;
        }
        .row-status {
          grid-column: 2;
          grid-row: 2;
          border-left: 0;
          padding-left: 0;
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
        .home-heading {
          flex-direction: column;
        }
        .feature-task {
          grid-template-columns: 48px 1fr;
          padding: 20px;
        }
        .feature-task .btn {
          grid-column: 1/-1;
          justify-content: center;
        }
        .work-row {
          grid-template-columns: 44px minmax(0, 1fr);
          gap: 12px;
          padding: 17px;
        }
        .row-status {
          grid-column: 2;
          grid-row: auto;
        }
        .row-tail {
          grid-column: 2;
          grid-row: auto;
          min-height: 44px;
        }
        .section-heading {
          padding: 18px;
          align-items: flex-start;
          flex-direction: column;
        }
        .home-aside {
          grid-template-columns: 1fr;
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
    this.notificationCount() ? 'Revisão humana' : 'Nenhuma sem decisão',
  );
  readonly heading = computed(() =>
    this.session.role() === 'gestor'
      ? 'Olá, gestor'
      : this.session.role() === 'residente'
        ? 'Olá, residente'
        : this.session.role() === 'saude'
          ? 'Saúde'
          : 'Olá, supervisora',
  );
  readonly intro = computed(() =>
    this.session.role() === 'gestor'
      ? 'Acompanhe cadastros e informações da residência.'
      : this.session.role() === 'residente'
        ? 'Acompanhe o que precisa da sua atenção.'
        : this.session.role() === 'saude'
          ? 'Acesso assistencial conforme sua habilitação e seus vínculos.'
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
          <span class="eyebrow">Suporte</span>
          <h1>Ajuda e perguntas frequentes</h1>
          <p>Encontre orientações para as tarefas mais comuns.</p>
        </div>
      </header>
      <section class="help-intro panel">
        <div><span class="material-symbols-outlined" aria-hidden="true">support_agent</span></div>
        <div>
          <h2>Como usar esta demonstração</h2>
          <p>
            Escolha um perfil para navegar. As informações das telas são fictícias e as ações ficam
            apenas nesta sessão.
          </p>
          <a routerLink="/demonstracao">Escolher perfil de demonstração</a>
        </div>
      </section>
      <h2>Guias por tarefa</h2>
      <div class="guide-grid">
        <a routerLink="/chamada"
          ><span class="material-symbols-outlined" aria-hidden="true">fact_check</span
          ><strong>Fazer a chamada</strong><span>Marque, revise e confirme a presença.</span></a
        ><a routerLink="/saidas"
          ><span class="material-symbols-outlined" aria-hidden="true">directions_walk</span
          ><strong>Acompanhar saídas</strong><span>Entenda análise, assinatura e retorno.</span></a
        ><a routerLink="/avisos"
          ><span class="material-symbols-outlined" aria-hidden="true">campaign</span
          ><strong>Ver avisos</strong><span>Saiba como registrar ciência explícita.</span></a
        ><a routerLink="/relatorios"
          ><span class="material-symbols-outlined" aria-hidden="true">monitoring</span
          ><strong>Consultar relatórios</strong
          ><span>Combine filtros e leia os resultados.</span></a
        >
      </div>
      <section class="faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Perguntas frequentes</h2>
        <details>
          <summary>Esta demonstração usa dados reais?</summary>
          <p>
            Não. Todos os nomes e registros apresentados são sintéticos. As alterações não são
            enviadas a serviços externos.
          </p>
        </details>
        <details>
          <summary>Quem confirma o retorno de uma saída curta?</summary>
          <p>
            O supervisor registra a confirmação depois de verificar presencialmente a chegada do
            residente.
          </p>
        </details>
        <details>
          <summary>A saída longa pode ser aprovada antes da assinatura?</summary>
          <p>
            Não. A jornada exige assinatura válida e documento armazenado antes da aprovação. Aqui,
            a assinatura é apenas uma simulação sem validade jurídica.
          </p>
        </details>
        <details>
          <summary>Uma notificação gera advertência automaticamente?</summary>
          <p>
            Não. O supervisor analisa a ocorrência e decide se deve arquivar ou registrar uma
            advertência manual.
          </p>
        </details>
        <details>
          <summary>Abrir um aviso significa dar ciência?</summary>
          <p>Não. A ciência depende de um botão específico e de confirmação.</p>
        </details>
        <details>
          <summary>O ranking e os relatórios já usam fórmulas definitivas?</summary>
          <p>
            Não. Critérios, pesos e a métrica de comportamento dependem de definição da Assistência
            Estudantil.
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
        max-width: 1120px;
      }
      .eyebrow {
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #17683f;
        font-weight: 800;
      }
      .help-intro {
        display: flex;
        gap: 18px;
        align-items: flex-start;
        padding: 24px;
        margin: 25px 0 36px;
      }
      .help-intro > div:first-child {
        background: #e7f2e8;
        color: #17683f;
        padding: 12px;
        border-radius: 12px;
      }
      .help-intro h2 {
        margin: 0 0 7px;
      }
      .help-intro p {
        margin: 0 0 12px;
        color: #526258;
        line-height: 1.5;
      }
      .help-intro a {
        color: #115b38;
        font-weight: 800;
        min-height: 44px;
        display: inline-flex;
        align-items: center;
      }
      .guide-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
        margin: 17px 0 40px;
      }
      .guide-grid a {
        display: flex;
        flex-direction: column;
        gap: 9px;
        background: #fff;
        border: 1px solid #dce5dc;
        border-radius: 12px;
        padding: 22px;
        text-decoration: none;
        color: #23402d;
        min-height: 178px;
      }
      .guide-grid a:hover {
        border-color: #3b8e5d;
      }
      .guide-grid .material-symbols-outlined {
        color: #17683f;
        font-size: 31px;
      }
      .guide-grid strong {
        font-size: 1.02rem;
      }
      .guide-grid span:last-child {
        color: #5d685e;
        font-size: 0.86rem;
        line-height: 1.45;
      }
      .faq {
        max-width: 850px;
      }
      .faq details {
        border-top: 1px solid #dce5dc;
        padding: 6px 0;
      }
      .faq details:last-child {
        border-bottom: 1px solid #dce5dc;
      }
      .faq summary {
        cursor: pointer;
        font-weight: 700;
        min-height: 54px;
        padding: 16px 6px;
      }
      .faq p {
        color: #4c5c50;
        line-height: 1.6;
        padding: 0 6px 14px;
        margin: 0;
      }
      @media (max-width: 1000px) {
        .guide-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 560px) {
        .guide-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class HelpPage {}

@Component({
  standalone: true,
  selector: 'sager-profile',
  imports: [RouterLink],
  template: `<main class="page simple-page">
    <header class="page-header">
      <div>
        <h1>Meu perfil</h1>
        <p>{{ session.active() ? 'Conta de demonstração' : 'Conta local de desenvolvimento' }}</p>
      </div>
    </header>
    <section class="panel profile-panel">
      <div class="profile-avatar">
        <span class="material-symbols-outlined" aria-hidden="true">person</span>
      </div>
      <div>
        <strong>{{ session.active() ? label() : auth.principal()?.nome }}</strong
        ><span>{{ session.active() ? 'IF Goiano · Campus Urutaí' : auth.principal()?.email }}</span>
        @if (session.active()) {
          <small>Dados fictícios da demonstração</small>
        } @else {
          <small>Perfil da conta: {{ localRoleLabel() }}</small>
        }
      </div>
    </section>
    @if (!session.active()) {
      @if (auth.principal()?.perfis?.[0] === 'saude') {
        <section class="profile-link" aria-labelledby="profile-health-title">
          <h2 id="profile-health-title">Acesso assistencial</h2>
          <p>Sua habilitação e os residentes assistidos são conferidos na área de saúde.</p>
          <a routerLink="/saude">Abrir área de saúde</a>
        </section>
      } @else {
        <section class="profile-link" aria-labelledby="profile-link-title">
          <h2 id="profile-link-title">Vínculo cadastral</h2>
          @if (auth.principal()?.residenteId; as recordId) {
            <p>Cadastro de residente vinculado</p>
            <details>
              <summary>Referência do cadastro</summary>
              <code>{{ recordId }}</code>
            </details>
          } @else if (auth.principal()?.supervisorId; as recordId) {
            <p>Cadastro de supervisor vinculado</p>
            <details>
              <summary>Referência do cadastro</summary>
              <code>{{ recordId }}</code>
            </details>
          } @else {
            <p>Conta sem cadastro vinculado</p>
            <p>Para associar sua conta ao cadastro, solicite o vínculo ao operador do SAGER.</p>
          }
        </section>
      }
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
        gap: 22px;
        align-items: center;
        padding: 28px;
        margin: 24px 0;
      }
      .profile-avatar {
        flex-shrink: 0;
        width: 72px;
        height: 72px;
        display: grid;
        place-items: center;
        background: #e7f2e8;
        border-radius: 100%;
        color: #17683f;
      }
      .profile-avatar .material-symbols-outlined {
        font-size: 39px;
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
        margin: 5px 0;
      }
      .profile-panel small {
        color: #607164;
      }
      .profile-panel > div:last-child {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .profile-link {
        padding-block: 4px 24px;
      }
      .profile-link h2 {
        font-size: 1.2rem;
        margin: 0 0 12px;
      }
      .profile-link p {
        line-height: 1.6;
      }
      .profile-link summary {
        cursor: pointer;
        min-height: 44px;
        display: list-item;
        align-content: center;
        color: var(--green-900);
      }
      .profile-link code {
        display: block;
        overflow-wrap: anywhere;
        padding-block: 8px;
      }
      @media (max-width: 520px) {
        .profile-panel {
          align-items: flex-start;
          padding: 20px;
          gap: 16px;
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
      ({ gestor: 'Gestor', supervisor: 'Supervisor', residente: 'Residente', saude: 'Saúde' })[
        this.auth.principal()?.perfis[0] ?? 'residente'
      ],
  );
  readonly label = computed(
    () =>
      ({
        gestor: 'Gestor da Assistência Estudantil',
        supervisor: 'Supervisor da residência',
        residente: 'Residente',
        saude: 'Profissional de saúde',
      })[this.session.role()],
  );
}

@Component({
  standalone: true,
  selector: 'sager-denied',
  imports: [RouterLink],
  template: `<main class="page status-page">
    <span class="material-symbols-outlined" aria-hidden="true">lock</span>
    <h1>Acesso não disponível para este perfil</h1>
    <p>
      {{
        session.active()
          ? 'Esta área pertence a outra jornada da demonstração. Escolha um perfil compatível para continuar.'
          : 'O perfil da sua conta local não permite esta área.'
      }}
    </p>
    <div class="action-row">
      @if (session.active()) {
        <a class="btn" routerLink="/demonstracao">Escolher outro perfil</a>
      }
      <a class="btn-secondary" routerLink="/inicio">Voltar ao início</a>
    </div>
  </main>`,
  styles: [
    `
      :host {
        display: block;
      }
      .status-page {
        max-width: 680px;
        margin: 7vh auto;
        text-align: center;
      }
      .status-page > .material-symbols-outlined {
        font-size: 52px;
        color: #1b6b44;
        background: #e7f2e8;
        padding: 17px;
        border-radius: 16px;
      }
      .status-page h1 {
        margin: 24px 0 10px;
      }
      .status-page p {
        color: #536258;
        font-size: 1.05rem;
        line-height: 1.6;
      }
      .action-row {
        justify-content: center;
      }
    `,
  ],
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
  styles: [
    `
      :host {
        display: block;
      }
      .status-page {
        max-width: 620px;
        margin: 7vh auto;
        text-align: center;
      }
      .status-page > .material-symbols-outlined {
        font-size: 52px;
        color: #1b6b44;
        background: #e7f2e8;
        padding: 17px;
        border-radius: 16px;
      }
      .status-page h1 {
        margin: 24px 0 10px;
      }
      .status-page p {
        color: #536258;
        font-size: 1.05rem;
        line-height: 1.6;
        margin-bottom: 26px;
      }
    `,
  ],
})
export class NotFoundPage {}
