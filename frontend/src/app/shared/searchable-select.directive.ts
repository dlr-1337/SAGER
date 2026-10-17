import { AfterViewInit, DestroyRef, Directive, ElementRef, Renderer2, inject } from '@angular/core';
import { normalizeSearch } from './search';
/** Keep native keyboard selection; narrow long catalogs without changing their values. */
@Directive({ selector: 'select[sagerSearchable]', standalone: true })
export class SearchableSelectDirective implements AfterViewInit {
  private readonly element = inject<ElementRef<HTMLSelectElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly destroy = inject(DestroyRef);
  ngAfterViewInit(): void {
    const select = this.element.nativeElement;
    const label = select.labels?.[0];
    const name =
      select.getAttribute('aria-label') ||
      Array.from(label?.childNodes ?? [])
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim() ||
      'opções';
    const input: HTMLInputElement = this.renderer.createElement('input');
    input.type = 'search';
    input.placeholder = 'Buscar opções';
    input.setAttribute('aria-label', 'Buscar opções de ' + name);
    input.setAttribute('data-filter-input', 'true');
    input.autocomplete = 'off';
    input.className = 'select-search';
    input.style.width = '100%';
    input.style.minWidth = '0';
    input.style.marginBottom = '6px';
    if (!select.id) select.id = 'select-' + crypto.randomUUID();
    input.setAttribute('aria-controls', select.id);
    if (label && !label.htmlFor) label.htmlFor = select.id;
    if (!select.getAttribute('aria-label') && !select.getAttribute('aria-labelledby'))
      select.setAttribute('aria-label', name);
    const filter = () => {
      if (select.options.length > 8) {
        if (!input.isConnected) this.renderer.insertBefore(select.parentNode, input, select);
      } else {
        input.remove();
        input.value = '';
      }
      const query = normalizeSearch(input.value);
      for (const option of Array.from(select.options))
        option.hidden =
          !!query &&
          !!option.value &&
          !option.selected &&
          !normalizeSearch(option.textContent).includes(query);
    };
    const stopInput = this.renderer.listen(input, 'input', filter);
    const stopKeys = this.renderer.listen(input, 'keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') event.preventDefault();
      if (event.key === 'Escape') {
        input.value = '';
        filter();
        event.stopPropagation();
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        select.focus();
      }
    });
    const stopChange = this.renderer.listen(select, 'change', filter);
    const observer = new MutationObserver(filter);
    observer.observe(select, { childList: true, subtree: true });
    filter();
    this.destroy.onDestroy(() => {
      observer.disconnect();
      stopInput();
      stopKeys();
      stopChange();
      input.remove();
    });
  }
}
