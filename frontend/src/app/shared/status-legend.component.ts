import { Component, input } from '@angular/core';
import { statusTones, toneAttr } from './status-tones';

/** Legenda recolhida das cores de situação da tela (simple-screens, design D6). */
@Component({
  selector: 'sager-status-legend',
  standalone: true,
  template: `<details class="status-legend">
    <summary>O que significa cada cor?</summary>
    <dl>
      @for (name of names(); track name) {
        <div>
          <dt>
            <span class="status" [attr.data-tone]="tone(name)">{{ name }}</span>
          </dt>
          <dd>{{ meanings[name]?.meaning }}</dd>
        </div>
      }
    </dl>
  </details>`,
})
export class StatusLegendComponent {
  /** Nomes que a tela pode mostrar, na ordem da legenda. */
  readonly names = input.required<readonly string[]>();
  readonly tone = toneAttr;
  readonly meanings = statusTones;
}
