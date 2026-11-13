import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { OperationsDemoService } from './operations-demo.service';

type Period = 'Semanal' | 'Mensal' | 'Semestral';
interface RankRow {
  room: string;
  position: number;
  own: boolean;
}

const EXAMPLE_RANKINGS: Record<Period, RankRow[]> = {
  Semanal: [
    { room: 'B-203', position: 1, own: false },
    { room: 'A-102', position: 2, own: true },
    { room: 'A-104', position: 3, own: false },
    { room: 'B-201', position: 4, own: false },
  ],
  Mensal: [
    { room: 'A-104', position: 1, own: false },
    { room: 'A-102', position: 2, own: true },
    { room: 'B-203', position: 3, own: false },
    { room: 'B-201', position: 4, own: false },
  ],
  Semestral: [
    { room: 'B-203', position: 1, own: false },
    { room: 'A-104', position: 2, own: false },
    { room: 'A-102', position: 3, own: true },
    { room: 'B-201', position: 4, own: false },
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
          <a routerLink="/inicio" class="op-back">← Início</a>
          <h1>Ranking de organização</h1>
          <p>Consulte a posição dos quartos por período.</p>
        </div>
        <span class="op-demo-label">Classificação ilustrativa</span>
      </header>
      <section class="op-alert-panel" role="note">
        <span class="material-symbols-outlined" aria-hidden="true">info</span>
        <div>
          <h2>Fórmula pendente da AE</h2>
          <p>
            Posições e períodos são exemplos sintéticos. Critérios, pesos, desempates e método de
            cálculo ainda serão homologados.
          </p>
        </div>
      </section>
      <section class="panel op-panel" aria-labelledby="ranking-title">
        <div class="op-section-heading">
          <h2 id="ranking-title">Classificação {{ period().toLocaleLowerCase('pt-BR') }}</h2>
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
              <strong>{{ row.position }}ª posição</strong><span>Quarto {{ row.room }}</span>
              @if (row.own && session.hasRole('residente')) {
                <span class="op-own-tag">Seu quarto</span>
              }
            </li>
          }
        </ol>
        @if (session.hasRole('residente')) {
          <p class="op-help">
            Você pode consultar as posições de todos os quartos. Detalhes de avaliação de outros
            dormitórios não aparecem aqui.
          </p>
        }
        @if (service.cleaningFeedback(); as feedback) {
          @if (!session.hasRole('residente') || feedback.room === 'A-102') {
            <p class="op-help">
              Última simulação de limpeza: quarto {{ feedback.room }}, nota ilustrativa
              {{ feedback.next }}. A classificação acima permanece um exemplo preparado até a
              fórmula ser definida.
            </p>
          }
        }
      </section>
    </main>
  `,
})
export class RankingComponent {
  readonly session = inject(SessionService);
  readonly service = inject(OperationsDemoService);
  readonly periods: Period[] = ['Semanal', 'Mensal', 'Semestral'];
  readonly period = signal<Period>('Semanal');
  readonly rows = computed(() => EXAMPLE_RANKINGS[this.period()]);
}
