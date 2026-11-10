import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MonthlyIndicator } from './cleaning-local.models';
type SeriesKey = 'unjustifiedAbsences' | 'confirmedLateReturns' | 'activeWarnings';
/** At most 13 months/39 DOM bars. One shared zero-based scale; labels and the table remain visible. */
@Component({
  standalone: true,
  selector: 'sager-monthly-indicators',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="comm-help">
      Cada lista conta uma coisa: faltas nas chamadas já fechadas, voltas com atraso e advertências
      que ainda valem. O sistema não dá nota de comportamento.
    </p>
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
                    [style.width.%]="(item[series.key] / maximum()) * 100"
                  ></span>
                </div>
                <strong>{{ item[series.key] }}</strong>
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
            <th scope="col">Faltas</th>
            <th scope="col">Atrasos</th>
            <th scope="col">Advertências</th>
          </tr>
        </thead>
        <tbody>
          @for (item of items; track item.month) {
            <tr>
              <th scope="row">{{ month(item.month) }}</th>
              <td>{{ item.unjustifiedAbsences }}</td>
              <td>{{ item.confirmedLateReturns }}</td>
              <td>{{ item.activeWarnings }}</td>
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
  @Input({ required: true }) items: MonthlyIndicator[] = [];
  readonly seriesList: { key: SeriesKey; label: string }[] = [
    { key: 'unjustifiedAbsences', label: 'Ausências sem justificativa' },
    { key: 'confirmedLateReturns', label: 'Voltas com atraso' },
    { key: 'activeWarnings', label: 'Advertências valendo' },
  ];
  maximum(): number {
    return Math.max(
      1,
      ...this.items.flatMap((item) => this.seriesList.map((series) => item[series.key])),
    );
  }
  month(value: string): string {
    const [year, month] = value.split('-');
    return `${month}/${year}`;
  }
}
