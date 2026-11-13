import { ERROR_GENERIC, readableError } from '../../core/error-messages';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { LocalAuthService } from '../../core/local-auth.service';
import { PasswordFieldComponent } from '../../shared/password-field.component';

@Component({
  standalone: true,
  selector: 'sager-access',
  imports: [RouterLink, ReactiveFormsModule, PasswordFieldComponent],
  template: `
    <header class="masthead public-masthead">
      <div class="brand-organization">
        <img src="/if-goiano-urutai.png" alt="Instituto Federal Goiano, Campus Urutaí" />
      </div>
      <div class="brand-product">
        <strong>SAGER</strong><span>Sistema de Apoio à Gestão da<br />Residência Estudantil</span>
      </div>
      @if (!session.production) {
        <div class="environment-flag">
          <strong>Acesso local</strong><span>Desenvolvimento e testes</span>
        </div>
      }
    </header>
    <main class="access-main">
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
            <a routerLink="/ajuda">Ajuda para acessar</a>
            <span>É supervisor ou gestor? Peça ao suporte para trocar sua senha.</span>
          </div>
        </form>
      </section>
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
        max-width: 640px;
        margin: 0 auto;
        padding: 56px clamp(16px, 3vw, 40px) 48px;
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
      .access-card {
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
      @media (max-width: 760px) {
        .access-main {
          padding-top: 24px;
        }
        .access-card {
          padding: 18px;
        }
      }
    `,
  ],
})
export class AccessPage {
  private readonly auth = inject(LocalAuthService);
  readonly session = inject(SessionService);
  private readonly router = inject(Router);
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
      this.form.controls.password.reset();
      await this.router.navigateByUrl('/inicio');
    } catch (error) {
      this.error.set(readableError(error, ERROR_GENERIC));
    } finally {
      this.busy.set(false);
    }
  }
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
          <h2>Usar sua conta SAGER</h2>
          <p>
            Entre com sua matrícula e a senha do SAGER. O que aparece na tela depende da sua função.
            Confira os dados antes de confirmar.
          </p>
          <a routerLink="/perfil">Ver meu perfil</a>
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
          <a [routerLink]="session.role() === 'residente' ? '/avisos' : '/comunicacoes/avisos'"
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
          <a routerLink="/minha-limpeza"
            ><span class="material-symbols-outlined" aria-hidden="true">cleaning_services</span
            ><strong>Minha limpeza</strong><span>Veja as notas e a posição do quarto.</span></a
          >
        }
        @if (session.hasRole('saude')) {
          <a routerLink="/saude"
            ><span class="material-symbols-outlined" aria-hidden="true">health_and_safety</span
            ><strong>Atendimento de saúde</strong
            ><span>Veja os atendimentos que você pode acessar.</span></a
          >
        }
      </div>
      <section class="faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Perguntas frequentes</h2>
        <details>
          <summary>Como recuperar ou alterar minha senha?</summary>
          <p>
            Procure o suporte da instituição. Alguém da equipe confere quem você é e troca sua
            senha. Depois, entre com a senha nova.
          </p>
        </details>
        <details>
          <summary>Quem confirma o retorno de uma saída curta?</summary>
          <p>O supervisor registra a volta depois de ver o residente chegar.</p>
        </details>
        <details>
          <summary>A saída longa pode ser aprovada antes da autorização?</summary>
          <p>
            Não. Um servidor precisa conferir a autorização do responsável antes da aprovação. Se o
            WhatsApp não estiver funcionando, o supervisor anexa o arquivo recebido por outro meio.
            Mensagem entregue não confirma a autorização nem a saída.
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
            A nota de limpeza é a média dos quatro itens. Quartos com a mesma média ficam na mesma
            posição. A tela e os arquivos mostram os mesmos dados.
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
  readonly session = inject(SessionService);
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
          {{ session.production ? 'Conta do SAGER' : 'Conta local de desenvolvimento' }}
        </p>
      </div>
    </header>
    <section class="panel profile-panel">
      <div class="profile-avatar">
        <span class="material-symbols-outlined" aria-hidden="true">person</span>
      </div>
      <div>
        <strong>{{ auth.principal()?.nome }}</strong
        ><span>{{ auth.principal()?.matricula }}</span>
        <small>Perfil da conta: {{ localRoleLabel() }}</small>
      </div>
    </section>
    @if (auth.principal()?.perfis?.[0] === 'saude') {
      <section class="profile-link" aria-labelledby="profile-health-title">
        <h2 id="profile-health-title">Área de saúde</h2>
        <p>Veja seus atendimentos na área de saúde.</p>
        <a routerLink="/saude">Abrir área de saúde</a>
      </section>
    } @else {
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
  readonly session = inject(SessionService);
  readonly auth = inject(LocalAuthService);
  readonly localRoleLabel = computed(
    () =>
      ({ gestor: 'Gestor', supervisor: 'Supervisor', residente: 'Residente', saude: 'Saúde' })[
        this.auth.principal()?.perfis[0] ?? 'residente'
      ],
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
    <p>O perfil da sua conta não permite esta área.</p>
    <div class="action-row">
      <a class="btn-secondary" routerLink="/inicio">Voltar ao início</a>
    </div>
  </main>`,
  styles: [statusPageStyles],
})
export class DeniedPage {}

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
