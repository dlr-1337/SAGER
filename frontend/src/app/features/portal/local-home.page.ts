import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { LocalAuthService } from '../../core/local-auth.service';

const todayFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'full',
  timeZone: 'America/Sao_Paulo',
});
const clockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Milissegundos até a próxima meia-noite civil em America/Sao_Paulo. */
export function msUntilNextMidnight(now: Date): number {
  const [hours, minutes, seconds] = clockFormat.format(now).split(':').map(Number);
  return ((24 - hours) * 3600 - minutes * 60 - seconds) * 1000 - now.getMilliseconds();
}

interface HomeTask {
  title: string;
  text: string;
  icon: string;
  links: { label: string; to: string }[];
}

const supervisorTasks: HomeTask[] = [
  {
    title: 'Chamada noturna',
    text: 'Abra a chamada e confira as marcações dos residentes menores de idade.',
    icon: 'bedtime',
    links: [{ label: 'Abrir chamada', to: '/chamada' }],
  },
  {
    title: 'Saídas e retornos',
    text: 'Analise as solicitações e registre a partida ou a chegada presencial.',
    icon: 'directions_walk',
    links: [{ label: 'Consultar saídas', to: '/saidas' }],
  },
  {
    title: 'Notificações e advertências',
    text: 'Confira a origem das ocorrências e registre a análise antes de uma decisão.',
    icon: 'notifications',
    links: [
      { label: 'Analisar notificações', to: '/notificacoes' },
      { label: 'Consultar advertências', to: '/advertencias' },
    ],
  },
  {
    title: 'Avisos institucionais',
    text: 'Prepare avisos para os residentes selecionados e confira a versão publicada.',
    icon: 'campaign',
    links: [{ label: 'Gerenciar avisos', to: '/comunicacoes/avisos' }],
  },
];

const residentTasks: HomeTask[] = [
  {
    title: 'Minhas saídas',
    text: 'Solicite uma saída e acompanhe a decisão e o histórico.',
    icon: 'directions_walk',
    links: [{ label: 'Ver minhas saídas', to: '/saidas' }],
  },
  {
    title: 'Minhas comunicações',
    text: 'Acompanhe avisos, advertências e termos. Leitura e ciência são registradas separadamente.',
    icon: 'campaign',
    links: [{ label: 'Consultar comunicações', to: '/avisos' }],
  },
  {
    title: 'Minha saúde',
    text: 'Consulte e exporte os registros de saúde vinculados ao seu cadastro.',
    icon: 'health_and_safety',
    links: [{ label: 'Consultar minha saúde', to: '/minha-saude' }],
  },
  {
    title: 'Minha limpeza',
    text: 'Consulte as avaliações vinculadas ao seu quarto e acompanhe o período do ranking.',
    icon: 'cleaning_services',
    links: [
      { label: 'Consultar minhas avaliações', to: '/minha-limpeza' },
      { label: 'Consultar ranking', to: '/ranking' },
    ],
  },
];

const healthTasks: HomeTask[] = [
  {
    title: 'Atendimento de saúde',
    text: 'Consulte os residentes assistidos e os registros autorizados para você.',
    icon: 'health_and_safety',
    links: [{ label: 'Abrir área de saúde', to: '/saude' }],
  },
];

const staffTasks: HomeTask[] = [
  {
    title: 'Avaliações de limpeza',
    text: 'Confira as avaliações e seus participantes históricos. Veja a regra e o período.',
    icon: 'cleaning_services',
    links: [
      { label: 'Consultar avaliações', to: '/limpeza' },
      { label: 'Consultar ranking', to: '/ranking' },
    ],
  },
  {
    title: 'Relatórios',
    text: 'Escolha uma consulta e confira os mesmos dados na prévia e na exportação.',
    icon: 'description',
    links: [{ label: 'Consultar relatórios', to: '/relatorios' }],
  },
  {
    title: 'Cadastros e alocações',
    text: 'Consulte residentes, responsáveis e vínculos de moradia.',
    icon: 'groups',
    links: [{ label: 'Consultar residentes', to: '/residentes' }],
  },
  {
    title: 'Acessos de saúde',
    text: 'Gerencie habilitações e vínculos assistenciais da equipe.',
    icon: 'admin_panel_settings',
    links: [{ label: 'Gerenciar acessos', to: '/saude/acessos' }],
  },
];

@Component({
  standalone: true,
  selector: 'sager-local-home',
  imports: [RouterLink],
  // Timers param durante o repouso do aparelho; ao voltar, a data é conferida de novo.
  host: { '(document:visibilitychange)': 'refreshDate()', '(window:focus)': 'refreshDate()' },
  template: `
    <main class="page local-home">
      <header class="page-header">
        <div>
          <span class="eyebrow">{{ today() }}</span>
          <h1>{{ heading() }}</h1>
          <p>{{ auth.principal()?.nome }} · {{ session.production ? 'SAGER' : 'Acesso local' }}</p>
        </div>
      </header>
      <section class="tasks" aria-label="Atividades disponíveis">
        @for (task of tasks(); track task.title; let first = $first) {
          <article [class]="first ? 'hero home-hero' : 'item'">
            <div class="what">
              <span class="badge home-badge" aria-hidden="true"
                ><span class="material-symbols-outlined" [class.home-hero-icon]="first">{{
                  task.icon
                }}</span></span
              >
              <div>
                <h2>{{ task.title }}</h2>
                <p>{{ task.text }}</p>
              </div>
            </div>
            <div class="actions">
              @for (link of task.links; track link.to; let primary = $first) {
                <a [class]="primary ? 'btn' : 'btn-secondary'" [routerLink]="link.to">{{
                  link.label
                }}</a>
              }
            </div>
          </article>
        }
      </section>
    </main>
  `,
  styles: `
    .eyebrow {
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .tasks {
      display: flex;
      flex-direction: column;
    }
    .hero,
    .item {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px 24px;
    }
    .hero {
      gap: 16px 28px;
      margin-bottom: 28px;
    }
    .item {
      padding: 20px 0;
      border-top: 1px solid var(--line);
    }
    .item:last-child {
      border-bottom: 1px solid var(--line);
    }
    .what {
      flex: 999 1 280px;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .hero .badge {
      width: 48px;
      height: 48px;
      background: none;
      color: #fff;
    }
    h2 {
      margin: 0 0 4px;
    }
    .item h2 {
      font-size: 1.1rem;
    }
    .what p {
      margin: 0;
    }
    .item .what p {
      color: var(--muted);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    @media (max-width: 760px) {
      .actions,
      .actions a {
        flex: 1 1 auto;
      }
    }
  `,
})
export class LocalHomePage {
  readonly session = inject(DemoSessionService);
  readonly auth = inject(LocalAuthService);
  // A página pode ficar aberta durante o turno da noite; a data acompanha a virada do dia.
  private readonly now = signal(new Date());
  refreshDate(): void {
    this.now.set(new Date());
  }
  readonly today = computed(() => todayFormat.format(this.now()));
  readonly heading = computed(() =>
    this.session.role() === 'residente' ? 'Meu espaço' : 'Atividades do SAGER',
  );
  readonly tasks = computed(() => {
    const role = this.session.role();
    const own =
      role === 'supervisor'
        ? supervisorTasks
        : role === 'residente'
          ? residentTasks
          : role === 'saude'
            ? healthTasks
            : [];
    return role === 'gestor' || role === 'supervisor' ? [...own, ...staffTasks] : own;
  });

  constructor() {
    // Um disparo por dia, logo após a meia-noite, em vez de acordar a cada minuto.
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          this.now.set(new Date());
          schedule();
        },
        msUntilNextMidnight(new Date()) + 1000,
      );
    };
    schedule();
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}
