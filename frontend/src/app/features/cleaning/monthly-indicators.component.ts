import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
export type MonthlySeriesKey =
  'totalRows' | 'unjustifiedAbsences' | 'confirmedLateReturns' | 'activeWarnings';
export interface MonthlySeries {
  key: MonthlySeriesKey;
  label: string;
  /** Short heading of the table column. */
  column: string;
}
export type MonthlyRow = { month: string } & Partial<Record<MonthlySeriesKey, number>>;
/** The three lists of the individual evolution, also used by the consolidated report. */
export const INDICATOR_SERIES: MonthlySeries[] = [
  { key: 'unjustifiedAbsences', label: 'Ausências sem justificativa', column: 'Faltas' },
  { key: 'confirmedLateReturns', label: 'Voltas com atraso', column: 'Atrasos' },
  { key: 'activeWarnings', label: 'Advertências valendo', column: 'Advertências' },
];
export const INDICATOR_HELP =
  'Cada lista conta uma coisa: faltas nas chamadas já fechadas, voltas com atraso e advertências que ainda valem. O sistema não dá nota de comportamento.';
/** At most 13 months/39 DOM bars. One shared zero-based scale; labels and the table remain visible. */
@Component({
  standalone: true,
  selector: 'sager-monthly-indicators',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="comm-help">{{ help }}</p>
    @if (items.length) {
      <div class="indicator-stack">
        @for (series of seriesList; track series.key) {
          <figure
            class="indicator-series"
            [attr.aria-label]="series.label + ': mês a mês'"
            style="margin:0"
          >
            <figcaption>
              <h3>{{ series.label }}</h3>
            </figcaption>
            <p class="comm-help">A barra vai de 0 a {{ maximum() }}.</p>
            @for (item of items; track item.month) {
              <div class="indicator-row">
                <time [attr.datetime]="item.month">{{ month(item.month) }}</time>
                <div class="indicator-bar-slot" aria-hidden="true">
                  <span
                    class="indicator-bar"
                    [style.width.%]="(value(item, series.key) / maximum()) * 100"
                  ></span>
                </div>
                <strong>{{ value(item, series.key) }}</strong>
              </div>
            }
          </figure>
        }
      </div>
      <table class="indicator-table" tabindex="0">
        <caption>
          Números de cada mês
        </caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            @for (series of seriesList; track series.key) {
              <th scope="col">{{ series.column }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (item of items; track item.month) {
            <tr>
              <th scope="row">{{ month(item.month) }}</th>
              @for (series of seriesList; track series.key) {
                <td>{{ value(item, series.key) }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    } @else {
      <p>Não há dados para este período.</p>
    }
  `,
  styleUrl: './cleaning-local.scss',
})
export class MonthlyIndicatorsComponent {
  @Input({ required: true }) items: MonthlyRow[] = [];
  /** Each report passes only the counts of its subject; the individual evolution keeps the three. */
  @Input() seriesList: MonthlySeries[] = INDICATOR_SERIES;
  @Input() help = INDICATOR_HELP;
  value(item: MonthlyRow, key: MonthlySeriesKey): number {
    return item[key] ?? 0;
  }
  maximum(): number {
    return Math.max(
      1,
      ...this.items.flatMap((item) =>
        this.seriesList.map((series) => this.value(item, series.key)),
      ),
    );
  }
  month(value: string): string {
    const [year, month] = value.split('-');
    return `${month}/${year}`;
  }
}
