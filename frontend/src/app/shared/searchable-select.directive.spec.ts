import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { beforeAll, describe, expect, it } from 'vitest';
import { SearchableSelectDirective } from './searchable-select.directive';
import { UnsavedFormDirective } from './unsaved-form';

const NAMES = [
  'Escolhido',
  'João Silva',
  'José',
  'Ana',
  'Bruno',
  'Carla',
  'Davi',
  'Elisa',
  'Fábio',
];

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, SearchableSelectDirective, UnsavedFormDirective],
  template: `<form sagerUnsaved [sagerSaving]="busy">
    <label
      >Residente<select sagerSearchable [formControl]="selected">
        @for (name of names(); track name) {
          <option [value]="name" [disabled]="name === blocked()">{{ name }}</option>
        }
      </select></label
    ><input [formControl]="text" />
  </form>`,
})
class Host {
  readonly names = signal(NAMES);
  readonly blocked = signal('');
  readonly selected = new FormControl('Escolhido');
  readonly text = new FormControl('valor');
  readonly busy = signal(false);
}

const panel = () => document.querySelector<HTMLElement>('.select-panel');
const search = () => panel()!.querySelector('input')!;
const status = () => panel()!.querySelector('[role=status]')!.textContent;
const items = () => Array.from(panel()!.querySelectorAll<HTMLElement>('[role=option]'));
const labels = () => items().map((item) => item.textContent);
const press = (element: Element, key: string) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
};
const mouseDown = (element: Element) => {
  const event = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
};
const type = (text: string) => {
  search().value = text;
  search().dispatchEvent(new Event('input', { bubbles: true }));
};

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
  return { fixture, host: fixture.componentInstance, select };
}

describe('Seleção com busca e proteção do formulário', () => {
  beforeAll(() => {
    // jsdom has neither API; real browsers are covered by e2e/searchable-select.spec.ts.
    HTMLElement.prototype.showPopover ??= () => undefined;
    Element.prototype.scrollIntoView ??= () => undefined;
  });

  it('não mostra campo de busca até abrir e clica para escolher, ignorando acentos', async () => {
    const { fixture, host, select } = await setup();
    expect(document.querySelector('input[role=combobox]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('input')).toHaveLength(1);
    expect(mouseDown(select).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(search());
    expect(search().getAttribute('aria-label')).toBe('Buscar em Residente');
    type('JOAO');
    expect(labels()).toEqual(['João Silva']);
    expect(status()).toBe('1 opção');
    const changes: string[] = [];
    select.addEventListener('input', () => changes.push('input'));
    select.addEventListener('change', () => changes.push('change'));
    items()[0].click();
    expect(host.selected.value).toBe('João Silva');
    expect(changes).toEqual(['input', 'change']);
    expect(host.selected.dirty).toBe(true);
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(select);
  });

  it('informa a quantidade de resultados e quando nada é encontrado', async () => {
    const { select } = await setup();
    mouseDown(select);
    expect(status()).toBe('9 opções');
    expect(mouseDown(panel()!.querySelector('[role=status]')!).defaultPrevented).toBe(true);
    expect(mouseDown(search()).defaultPrevented).toBe(false);
    type('zzz');
    expect(status()).toBe('Nada encontrado.');
    expect(items()).toHaveLength(0);
    expect(search().hasAttribute('aria-activedescendant')).toBe(false);
    expect(press(search(), 'Enter').defaultPrevented).toBe(true);
    expect(panel()).not.toBeNull();
    mouseDown(select);
    expect(panel()).toBeNull();
  });

  it('deixa a lista de até 8 opções com o comportamento nativo', async () => {
    const { fixture, host, select } = await setup();
    host.names.set(NAMES.slice(0, 8));
    fixture.detectChanges();
    expect(select.options).toHaveLength(8);
    expect(mouseDown(select).defaultPrevented).toBe(false);
    expect(press(select, 'ArrowDown').defaultPrevented).toBe(false);
    expect(panel()).toBeNull();
  });

  it('abre pelo teclado, navega pulando opções desativadas e escolhe com Enter', async () => {
    const { fixture, host, select } = await setup();
    host.blocked.set('João Silva');
    fixture.detectChanges();
    await fixture.whenStable();
    select.focus();
    expect(press(select, 'ArrowDown').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(search());
    const current = () => items().find((item) => item.classList.contains('active'))?.textContent;
    expect(current()).toBe('Escolhido');
    expect(search().getAttribute('aria-activedescendant')).toBe(
      panel()!.querySelector('.active')!.id,
    );
    press(search(), 'ArrowDown');
    expect(current()).toBe('José');
    press(search(), 'ArrowUp');
    expect(current()).toBe('Escolhido');
    type('jos');
    expect(current()).toBe('José');
    press(search(), 'Enter');
    expect(host.selected.value).toBe('José');
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(select);
  });

  it('não escolhe opção desativada', async () => {
    const { fixture, host, select } = await setup();
    host.blocked.set('Ana');
    fixture.detectChanges();
    await fixture.whenStable();
    mouseDown(select);
    const item = items().find((candidate) => candidate.textContent === 'Ana')!;
    expect(item.getAttribute('aria-disabled')).toBe('true');
    item.click();
    expect(host.selected.value).toBe('Escolhido');
    expect(panel()).not.toBeNull();
  });

  it('fecha com Esc sem alterar o valor, sem avisar o diálogo e devolve o foco', async () => {
    const { host, select } = await setup();
    let reachedDocument = false;
    const listener = () => (reachedDocument = true);
    document.addEventListener('keydown', listener);
    mouseDown(select);
    type('ana');
    press(search(), 'Escape');
    document.removeEventListener('keydown', listener);
    expect(reachedDocument).toBe(false);
    expect(panel()).toBeNull();
    expect(host.selected.value).toBe('Escolhido');
    expect(document.activeElement).toBe(select);
  });

  it('fecha ao apertar fora e com Tab', async () => {
    const { fixture, select } = await setup();
    mouseDown(select);
    fixture.nativeElement
      .querySelector('input')
      .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(panel()).toBeNull();
    mouseDown(select);
    press(search(), 'Tab');
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(select);
  });

  it('mostra as novas opções quando a lista muda com o painel aberto', async () => {
    const { fixture, host, select } = await setup();
    mouseDown(select);
    host.names.set(NAMES.map((name) => name + ' 2'));
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    expect(labels()).toEqual(NAMES.map((name) => name + ' 2'));
    host.names.set(NAMES.slice(0, 8));
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    expect(panel()).toBeNull();
  });

  it('respeita campo desativado, antes e depois de abrir', async () => {
    const { host, select } = await setup();
    host.selected.disable();
    expect(mouseDown(select).defaultPrevented).toBe(false);
    expect(press(select, 'ArrowDown').defaultPrevented).toBe(false);
    expect(panel()).toBeNull();
    host.selected.enable();
    mouseDown(select);
    expect(panel()).not.toBeNull();
    host.selected.disable();
    await Promise.resolve();
    expect(panel()).toBeNull();
  });

  it('remove o painel quando o campo sai da tela', async () => {
    const { fixture, select } = await setup();
    mouseDown(select);
    fixture.destroy();
    expect(panel()).toBeNull();
  });

  it('impede editar durante o salvamento e restaura os campos depois', async () => {
    const { fixture, host, select } = await setup();
    host.busy.set(true);
    fixture.detectChanges();
    expect(select.disabled).toBe(true);
    host.busy.set(false);
    fixture.detectChanges();
    expect(select.disabled).toBe(false);
  });
});
