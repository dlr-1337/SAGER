import { Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { SessionService } from '../../core/session.service';
import { CleaningIndicatorsLocalPage } from '../cleaning/cleaning-indicators-local.page';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

@Component({
  standalone: true,
  selector: 'sager-individual-report',
  imports: [RouterLink, CleaningIndicatorsLocalPage],
  template: `
    @if (!session.active()) {
      <sager-cleaning-indicators-local />
    } @else {
      <main class="page individual-page">
        <a class="back-link" routerLink="/relatorios"
          ><span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>Voltar aos
          relatórios</a
        >
        <header class="page-header">
          <div>
            <span class="eyebrow">Painel individual · Dados fictícios</span>
            <h1>Ana Luísa Ribeiro</h1>
            <p>Histórico pedagógico e ocorrências do período demonstrativo.</p>
          </div>
        </header>
        <div class="context-strip">
          <span><strong>Período:</strong> julho a setembro de 2026</span
          ><span><strong>Quarto:</strong> A-102</span
          ><span><strong>Fonte:</strong> registros da demonstração</span>
        </div>
        @if (session.scenario() !== 'padrao') {
          <section class="panel empty-results" role="status">
            <span class="material-symbols-outlined" aria-hidden="true">{{
              session.scenario() === 'carregando'
                ? 'hourglass_top'
                : session.scenario() === 'erro'
                  ? 'error'
                  : 'inbox'
            }}</span>
            <h2>
              {{
                session.scenario() === 'carregando'
                  ? 'Carregando histórico'
                  : session.scenario() === 'erro'
                    ? 'Não foi possível carregar o histórico'
                    : 'Sem registros neste período'
              }}
            </h2>
            <p>
              {{
                session.scenario() === 'vazio'
                  ? 'Não há dados suficientes para apresentar gráficos neste cenário.'
                  : 'Este é um cenário de demonstração.'
              }}
            </p>
          </section>
        } @else {
          <section class="panel chart-panel" aria-labelledby="occurrence-chart-title">
            <div>
              <h2 id="occurrence-chart-title">Evolução das ocorrências</h2>
              <p>
                Houve uma ocorrência em agosto e uma em setembro; julho não tem ocorrências no
                exemplo.
              </p>
            </div>
            <div class="chart-wrap">
              <canvas
                #occurrenceChart
                role="img"
                aria-label="Gráfico de barras: julho 0 ocorrências, agosto 1, setembro 1"
              ></canvas>
            </div>
            <div class="table-scroll">
              <table>
                <caption>
                  Ocorrências por mês
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Mês</th>
                    <th scope="col">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Julho</td>
                    <td>0</td>
                  </tr>
                  <tr>
                    <td>Agosto</td>
                    <td>1</td>
                  </tr>
                  <tr>
                    <td>Setembro</td>
                    <td>1</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <div class="analysis-grid">
            <section class="panel">
              <h2>Distribuição por tipo</h2>
              <p>Uma ocorrência de chamada e uma de convivência neste exemplo.</p>
              <div class="table-scroll">
                <table>
                  <caption>
                    Ocorrências por tipo
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Tipo</th>
                      <th scope="col">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Chamada</td>
                      <td>1</td>
                    </tr>
                    <tr>
                      <td>Convivência</td>
                      <td>1</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
            <section class="panel pending-metric">
              <span class="material-symbols-outlined" aria-hidden="true">pending_actions</span>
              <h2>Evolução do comportamento</h2>
              <p>
                A métrica de comportamento ainda precisa de definição pela Assistência Estudantil.
                Nenhuma pontuação será calculada ou apresentada neste protótipo.
              </p>
              <strong>Definição institucional pendente</strong>
            </section>
          </div>
          <section class="panel history" aria-labelledby="history-title">
            <h2 id="history-title">Histórico pedagógico</h2>
            <ol>
              <li>
                <span class="history-date">18 set. 2026</span>
                <div>
                  <strong>Advertência registrada após análise manual</strong>
                  <p>Registro demonstrativo de decisão do supervisor.</p>
                </div>
              </li>
              <li>
                <span class="history-date">20 ago. 2026</span>
                <div>
                  <strong>Ocorrência registrada</strong>
                  <p>Encaminhada para análise; nenhuma sanção automática foi aplicada.</p>
                </div>
              </li>
              <li>
                <span class="history-date">10 jul. 2026</span>
                <div>
                  <strong>Início do período consultado</strong>
                  <p>Sem ocorrências registradas neste mês.</p>
                </div>
              </li>
            </ol>
          </section>
        }
      </main>
    }
  `,
  styleUrl: './individual-report.scss',
})
export class IndividualReportPage implements OnDestroy {
  readonly session = inject(SessionService);
  @ViewChild('occurrenceChart') set chartCanvas(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.chart?.destroy();
    this.chart = undefined;
    if (ref) this.createChart(ref.nativeElement);
  }
  private chart?: Chart;
  private createChart(canvas: HTMLCanvasElement): void {
    if (!this.session.active()) return;
    this.chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Julho', 'Agosto', 'Setembro'],
        datasets: [
          {
            label: 'Ocorrências',
            data: [0, 1, 1],
            backgroundColor: '#155c43', // --green-800
            borderRadius: 5,
            maxBarThickness: 70,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, precision: 0 },
            grid: { color: '#d6e0e5' }, // --line
          },
          x: { grid: { display: false } },
        },
      },
    });
  }
  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
