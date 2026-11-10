import { AfterViewInit, DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { normalizeSearch } from './search';

const MAX_NATIVE_OPTIONS = 8;
const OPEN_KEYS = ['ArrowDown', 'ArrowUp', ' ', 'F4'];
const GAP = 8;
const MIN_WIDTH = 280;
const MIN_ROOM = 220;
const MAX_HEIGHT = 420;

/** Long lists open a search panel over the page; the native select keeps the form value. */
@Directive({ selector: 'select[sagerSearchable]', standalone: true })
export class SearchableSelectDirective implements AfterViewInit {
  private readonly select = inject<ElementRef<HTMLSelectElement>>(ElementRef).nativeElement;
  private readonly destroy = inject(DestroyRef);
  private name = 'opções';
  private close: ((returnFocus: boolean) => void) | null = null;

  ngAfterViewInit(): void {
    const select = this.select;
    const label = select.labels?.[0];
    this.name =
      select.getAttribute('aria-label') ||
      Array.from(label?.childNodes ?? [])
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim() ||
      'opções';
    if (!select.id) select.id = 'select-' + crypto.randomUUID();
    if (label && !label.htmlFor) label.htmlFor = select.id;
    if (!select.getAttribute('aria-label') && !select.getAttribute('aria-labelledby'))
      select.setAttribute('aria-label', this.name);

    const listeners = new AbortController();
    const { signal } = listeners;
    select.addEventListener(
      'mousedown',
      (event) => {
        if (event.button !== 0 || !this.usesPanel()) return;
        // Without this the browser opens its own list and moves focus to the select.
        event.preventDefault();
        if (this.close) this.close(true);
        else this.open();
      },
      { signal },
    );
    select.addEventListener(
      'keydown',
      (event) => {
        if (!OPEN_KEYS.includes(event.key) || !this.usesPanel()) return;
        event.preventDefault();
        if (!this.close) this.open();
      },
      { signal },
    );
    this.destroy.onDestroy(() => {
      listeners.abort();
      this.close?.(false);
    });
  }

  private usesPanel(): boolean {
    return this.select.options.length > MAX_NATIVE_OPTIONS && !this.select.matches(':disabled');
  }

  private open(): void {
    const select = this.select;
    const panel = document.createElement('div');
    panel.className = 'select-panel';
    panel.popover = 'manual';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Digite para buscar';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-label', 'Buscar em ' + this.name);
    input.setAttribute('aria-controls', select.id + '-options');
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const list = document.createElement('ul');
    list.id = select.id + '-options';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', this.name);
    panel.append(input, status, list);

    let shown: HTMLOptionElement[] = [];
    let active = -1;
    const setActive = (index: number) => {
      list.children[active]?.classList.remove('active');
      active = index;
      const item = list.children[active];
      if (item) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
        input.setAttribute('aria-activedescendant', item.id);
      } else input.removeAttribute('aria-activedescendant');
    };
    const move = (step: number) => {
      for (let i = active + step; shown[i]; i += step) if (!shown[i].disabled) return setActive(i);
    };
    const choose = (option: HTMLOptionElement) => {
      if (option.disabled) return;
      const changed = !option.selected;
      close(true);
      if (!changed) return;
      option.selected = true;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const render = () => {
      if (!this.usesPanel()) return close(true);
      const query = normalizeSearch(input.value);
      shown = Array.from(select.options).filter(
        (option) => !option.hidden && normalizeSearch(option.text).includes(query),
      );
      active = -1;
      list.replaceChildren(
        ...shown.map((option, index) => {
          const item = document.createElement('li');
          item.id = `${list.id}-${index}`;
          item.setAttribute('role', 'option');
          item.setAttribute('aria-selected', String(option.selected));
          if (option.disabled) item.setAttribute('aria-disabled', 'true');
          item.textContent = option.text;
          item.addEventListener('click', () => choose(option));
          return item;
        }),
      );
      list.hidden = !shown.length;
      status.textContent = !shown.length
        ? 'Nada encontrado.'
        : shown.length === 1
          ? '1 opção'
          : `${shown.length} opções`;
      const selected = shown.findIndex((option) => option.selected && !option.disabled);
      setActive(selected >= 0 ? selected : shown.findIndex((option) => !option.disabled));
      this.place(panel);
    };

    const listeners = new AbortController();
    const { signal } = listeners;
    const observer = new MutationObserver(render);
    const close = (returnFocus: boolean) => {
      this.close = null;
      listeners.abort();
      observer.disconnect();
      panel.remove();
      if (returnFocus) select.focus();
    };
    this.close = close;

    input.addEventListener('input', render);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        move(event.key === 'ArrowDown' ? 1 : -1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (shown[active]) choose(shown[active]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        // A dialog behind the panel also closes on Esc.
        event.stopPropagation();
        close(true);
      } else if (event.key === 'Tab') {
        // Back on the select, the browser's own Tab continues to the neighboring field.
        close(true);
      }
    });
    // Keeps focus in the search, and the phone keyboard open, on taps anywhere in the panel.
    panel.addEventListener('mousedown', (event) => {
      if (event.target !== input) event.preventDefault();
    });
    document.addEventListener(
      'pointerdown',
      (event) => {
        const target = event.target as Node;
        if (!panel.contains(target) && target !== select) close(false);
      },
      { capture: true, signal },
    );
    const place = () => this.place(panel);
    window.addEventListener('scroll', place, { capture: true, passive: true, signal });
    window.addEventListener('resize', place, { signal });
    window.visualViewport?.addEventListener('resize', place, { signal });
    window.visualViewport?.addEventListener('scroll', place, { signal });
    observer.observe(select, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['disabled', 'hidden'],
    });

    // Inside the dialog or main: aria-modal hides anything else, and axe requires a landmark.
    (select.closest('mat-dialog-container, main') ?? document.body).append(panel);
    panel.showPopover();
    render();
    input.focus({ preventScroll: true });
  }

  private place(panel: HTMLElement): void {
    const box = this.select.getBoundingClientRect();
    const view = window.visualViewport;
    const viewTop = view?.offsetTop ?? 0;
    const viewBottom = viewTop + (view?.height ?? window.innerHeight);
    const pageWidth = document.documentElement.clientWidth;
    const width = Math.min(Math.max(box.width, MIN_WIDTH), pageWidth - 2 * GAP);
    const below = viewBottom - box.bottom - 2 * GAP;
    const above = box.top - viewTop - 2 * GAP;
    const room = Math.max(below, above);
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(GAP, Math.min(box.left, pageWidth - width - GAP))}px`;
    // With no room around the field (phone keyboard open) the panel takes the whole visible area.
    panel.style.maxHeight = `${Math.min(
      room >= MIN_ROOM ? room : viewBottom - viewTop - 2 * GAP,
      MAX_HEIGHT,
    )}px`;
    const height = panel.offsetHeight;
    const top = below >= height || below >= above ? box.bottom + GAP : box.top - GAP - height;
    panel.style.top = `${Math.max(viewTop + GAP, Math.min(top, viewBottom - height - GAP))}px`;
  }
}
