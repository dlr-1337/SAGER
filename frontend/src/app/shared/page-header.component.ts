import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <header class="page-header">
      <div class="heading-copy">
        <h1>{{ title() }}</h1>
        @if (description()) { <p>{{ description() }}</p> }
      </div>
      <div class="heading-actions"><ng-content /></div>
    </header>
  `,
  styles: [`
    .heading-copy { min-width: 0; }
    .heading-copy h1 { text-wrap: balance; }
    .heading-actions:empty { display: none; }
    .heading-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
  `],
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input('');
}
