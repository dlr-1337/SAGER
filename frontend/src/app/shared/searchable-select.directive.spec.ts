import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { SearchableSelectDirective } from './searchable-select.directive';
import { UnsavedFormDirective } from './unsaved-form';
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, SearchableSelectDirective, UnsavedFormDirective],
  template: `<form sagerUnsaved [sagerSaving]="busy">
    <label
      >Residente<select sagerSearchable [formControl]="selected">
        @for (name of names; track name) {
          <option [value]="name">{{ name }}</option>
        }
      </select></label
    ><input [formControl]="text" />
  </form>`,
})
class Host {
  readonly names = [
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
  readonly selected = new FormControl('Escolhido');
  readonly text = new FormControl('valor');
  readonly busy = signal(false);
}
describe('Seleção com busca e proteção do formulário', () => {
  it('cancela Enter somente na busca auxiliar sem alterar seleção, texto ou foco', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=search]');
    input.value = 'joao';
    input.dispatchEvent(new Event('input'));
    input.focus();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    expect(input.dispatchEvent(enter)).toBe(false);
    expect(enter.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('joao');
    expect(fixture.componentInstance.selected.value).toBe('Escolhido');
    for (const element of [
      fixture.nativeElement.querySelector('select'),
      fixture.nativeElement.querySelector('input:not([type=search])'),
    ]) {
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      expect(element.dispatchEvent(event)).toBe(true);
      expect(event.defaultPrevented).toBe(false);
    }
  });

  it('filtra sem acentos e mantém a seleção atual, com acesso pelo teclado', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=search]');
    expect(input.hidden).toBe(false);
    input.value = 'joao';
    input.dispatchEvent(new Event('input'));
    const options = Array.from(
      fixture.nativeElement.querySelectorAll('option'),
    ) as HTMLOptionElement[];
    expect(options.filter((o) => !o.hidden).map((o) => o.value)).toEqual([
      'Escolhido',
      'João Silva',
    ]);
    expect(fixture.componentInstance.selected.value).toBe('Escolhido');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(document.activeElement?.tagName).toBe('SELECT');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(options.every((o) => !o.hidden)).toBe(true);
  });
  it('impede editar durante o salvamento e restaura os campos depois', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select').disabled).toBe(true);
    fixture.componentInstance.busy.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select').disabled).toBe(false);
  });
});
