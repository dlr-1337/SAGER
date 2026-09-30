import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { LocalAuthService } from '../../core/local-auth.service';

@Component({
  standalone: true,
  selector: 'sager-local-home',
  imports: [RouterLink],
  template: `
    <main class="page local-home">
      <header class="page-header">
        <div>
          <h1>{{ heading() }}</h1>
          <p>{{ auth.principal()?.nome }} · {{ session.production ? 'SAGER' : 'Acesso local' }}</p>
        </div>
      </header>
      <section class="tasks" aria-label="Atividades disponíveis">
        @if (session.role() === 'supervisor') {
          <article>
            <h2>Chamada noturna</h2>
            <p>Abra a chamada e confira as marcações dos residentes menores de idade.</p>
            <a class="btn" routerLink="/chamada">Abrir chamada</a>
          </article>
          <article>
            <h2>Saídas e retornos</h2>
            <p>Analise as solicitações e registre a partida ou a chegada presencial.</p>
            <a class="btn" routerLink="/saidas">Consultar saídas</a>
          </article>
        } @else if (session.role() === 'residente') {
          <article>
            <h2>Minhas saídas</h2>
            <p>Solicite uma saída e acompanhe a decisão e o histórico.</p>
            <a class="btn" routerLink="/saidas">Ver minhas saídas</a>
          </article>
          <article>
            <h2>Minha saúde</h2>
            <p>Consulte e exporte os registros de saúde vinculados ao seu cadastro.</p>
            <a class="btn" routerLink="/minha-saude">Consultar minha saúde</a>
          </article>
        } @else if (session.role() === 'saude') {
          <article>
            <h2>Atendimento de saúde</h2>
            <p>Consulte os residentes assistidos e os registros autorizados para você.</p>
            <a class="btn" routerLink="/saude">Abrir área de saúde</a>
          </article>
        }
        @if (session.role() === 'gestor' || session.role() === 'supervisor') {
          <article>
            <h2>Cadastros e alocações</h2>
            <p>Consulte residentes, responsáveis e vínculos de moradia.</p>
            <a class="btn" routerLink="/residentes">Consultar residentes</a>
          </article>
          <article>
            <h2>Acessos de saúde</h2>
            <p>Gerencie habilitações e vínculos assistenciais da equipe.</p>
            <a class="btn" routerLink="/saude/acessos">Gerenciar acessos</a>
          </article>
        }
      </section>
    </main>
  `,
  styles: `
    .tasks {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
      gap: 24px;
      max-width: 1080px;
    }
    article {
      border-top: 2px solid var(--green-800);
      padding: 20px 0;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
    h2 {
      margin: 0;
      font-size: 1.35rem;
    }
    article p {
      margin: 0 0 8px;
      max-width: 46ch;
      flex: 1;
      color: var(--muted);
    }
  `,
})
export class LocalHomePage {
  readonly session = inject(DemoSessionService);
  readonly auth = inject(LocalAuthService);
  readonly heading = computed(() =>
    this.session.role() === 'residente' ? 'Meu espaço' : 'Atividades do SAGER',
  );
}
