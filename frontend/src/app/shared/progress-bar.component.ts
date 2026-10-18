import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'sager-progress-bar',
  standalone: true,
  host: { role: 'img', '[attr.aria-label]': 'label()' },
  template: `<span [style.width.%]="percent()"></span>`,
  styles: `
    :host {
      display: block;
      height: 10px;
      margin: 0 0 16px;
      border-radius: 999px;
      background: var(--track);
      overflow: hidden;
    }
    span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--green-800);
    }
  `,
})
export class ProgressBarComponent {
  readonly done = input.required<number>();
  readonly total = input.required<number>();
  /** Completa o rótulo lido por leitores de tela: "3 de 5 {{ noun }}". */
  readonly noun = input.required<string>();
  readonly percent = computed(() => (this.total() ? (100 * this.done()) / this.total() : 0));
  readonly label = computed(() => `${this.done()} de ${this.total()} ${this.noun()}`);
}
