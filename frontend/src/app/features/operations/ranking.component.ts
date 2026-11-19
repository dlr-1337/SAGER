import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { decimal } from '../cleaning/cleaning-local.utils';
import { OperationsDemoService } from './operations-demo.service';

type Period = 'Últimos 5 dias' | 'Semanal' | 'Mensal' | 'Semestral';
interface RankRow {
  room: string;
  position: number | null;
  mean: number | null;
  own: boolean;
}

// Médias ilustrativas com duas casas: empate repete a posição e quarto sem avaliação fica sem nota.
const EXAMPLE_RANKINGS: Record<Period, RankRow[]> = {
  'Últimos 5 dias': [
    { room: 'A-102', position: 1, mean: 8.5, own: true },
    { room: 'B-203', position: 1, mean: 8.5, own: false },
    { room: 'A-104', position: 3, mean: 7.25, own: false },
    { room: 'B-201', position: null, mean: null, own: false },
  ],
  Semanal: [
    { room: 'B-203', position: 1, mean: 8.75, own: false },
    { room: 'A-102', position: 2, mean: 8.25, own: true },
    { room: 'A-104', position: 3, mean: 7.5, own: false },
    { room: 'B-201', position: 4, mean: 6.75, own: false },
  ],
  Mensal: [
    { room: 'A-104', position: 1, mean: 8.4, own: false },
    { room: 'A-102', position: 2, mean: 8.1, own: true },
    { room: 'B-203', position: 3, mean: 7.85, own: false },
    { room: 'B-201', position: 4, mean: 6.9, own: false },
  ],
  Semestral: [
    { room: 'B-203', position: 1, mean: 8.32, own: false },
    { room: 'A-104', position: 2, mean: 8.05, own: false },
    { room: 'A-102', position: 3, mean: 7.94, own: true },
    { room: 'B-201', position: 4, mean: 7.1, own: false },
  ],
};

@Component({
  standalone: true,
  selector: 'app-ranking',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page op-narrow">
      <header class="op-heading">
        <div>
          <a routerLink="/inicio" class="op-back"
            ><span class="back-arrow" aria-hidden="true">←</span>Início</a
          >
          <h1>Ranking de organização</h1>
          <p>Consulte a posição dos quartos por período.</p>
        </div>
        <span class="op-demo-label">Classificação ilustrativa</span>
      </header>
      <section class="op-alert-panel" role="note">
        <span class="material-symbols-outlined" aria-hidden="true">info</span>
        <div>
          <h2>Como o ranking é calculado</h2>
          <p>
            Média dos quatro critérios, com duas casas. O ranking abre nos últimos 5 dias: a média
            das notas de hoje e dos 4 dias anteriores, sem contar o dia sem avaliação. Semana, mês e
            semestre continuam como opções. Empates repetem a posição e quarto sem avaliação não
            recebe zero. Posições e notas são exemplos sintéticos.
          </p>
        </div>
      </section>
      <section class="panel op-panel" aria-labelledby="ranking-title">
        <div class="op-section-heading">
          <h2 id="ranking-title">{{ title() }}</h2>
          <p>Quartos demonstrativos</p>
        </div>
        <div class="op-periods" role="group" aria-label="Período do ranking">
          @for (option of periods; track option) {
            <button
              type="button"
              [class.selected]="period() === option"
              [attr.aria-pressed]="period() === option"
              (click)="period.set(option)"
            >
              {{ option }}
            </button>
          }
        </div>
        <ol class="op-ranking-list">
          @for (row of rows(); track row.room) {
            <li [class.own-room]="row.own && session.hasRole('residente')">
              <strong>{{
                row.position === null ? 'Sem posição' : row.position + 'ª posição'
              }}</strong
              ><span>Quarto {{ row.room }}</span>
              @if (row.own && session.hasRole('residente')) {
                <span class="op-own-tag">Seu quarto</span>
              }
              @if (!session.hasRole('residente') || row.own) {
                <span class="op-rank-score">{{
                  row.mean === null ? 'Sem nota' : decimal(row.mean)
                }}</span>
              }
            </li>
          }
        </ol>
        @if (session.hasRole('residente')) {
          <p class="op-help">
            Você pode consultar as posições de todos os quartos. A nota aparece só para o seu
            quarto.
          </p>
        }
        @if (service.cleaningFeedback(); as feedback) {
          @if (!session.hasRole('residente') || feedback.room === 'A-102') {
            <p class="op-help">
              Última simulação de limpeza: quarto {{ feedback.room }}, nota ilustrativa
              {{ decimal(feedback.next) }}. A classificação acima é um exemplo preparado para a
              demonstração.
            </p>
          }
        }
      </section>
    </main>
  `,
})
export class RankingComponent {
  readonly session = inject(DemoSessionService);
  readonly service = inject(OperationsDemoService);
  readonly decimal = decimal;
  readonly periods: Period[] = ['Últimos 5 dias', 'Semanal', 'Mensal', 'Semestral'];
  readonly period = signal<Period>('Últimos 5 dias');
  readonly rows = computed(() => EXAMPLE_RANKINGS[this.period()]);
  readonly title = computed(() =>
    this.period() === 'Últimos 5 dias'
      ? 'Classificação dos últimos 5 dias'
      : 'Classificação ' + this.period().toLocaleLowerCase('pt-BR'),
  );
}
