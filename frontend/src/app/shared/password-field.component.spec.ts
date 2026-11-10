import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { PasswordFieldComponent } from './password-field.component';

@Component({
  imports: [ReactiveFormsModule, PasswordFieldComponent],
  template: `<form [formGroup]="form">
    <label for="campo">Senha</label>
    <sager-password-field>
      <input id="campo" type="password" formControlName="password" />
    </sager-password-field>
    <button type="submit">Enviar</button>
  </form>`,
})
class Host {
  readonly form = new FormGroup({ password: new FormControl('segredo') });
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    root,
    input: root.querySelector('input')!,
    toggle: root.querySelector<HTMLButtonElement>('.password-toggle')!,
  };
}

describe('PasswordFieldComponent', () => {
  it('alterna a senha e o nome do botão, sem enviar o formulário nem perder o texto', async () => {
    const { fixture, root, input, toggle } = await setup();
    let submitted = 0;
    root.querySelector('form')!.addEventListener('submit', () => submitted++);
    expect(input.type).toBe('password');
    expect(toggle.type).toBe('button');
    expect(toggle.getAttribute('aria-label')).toBe('Mostrar senha');

    toggle.click();
    await fixture.whenStable();
    expect(input.type).toBe('text');
    expect(input.value).toBe('segredo');
    expect(input.spellcheck).toBe(false);
    expect(toggle.getAttribute('aria-label')).toBe('Ocultar senha');

    toggle.click();
    await fixture.whenStable();
    expect(input.type).toBe('password');
    expect(toggle.getAttribute('aria-label')).toBe('Mostrar senha');
    expect(submitted).toBe(0);
  });

  it('volta a ocultar a senha ao enviar o formulário', async () => {
    const { fixture, root, input, toggle } = await setup();
    toggle.click();
    await fixture.whenStable();
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(input.type).toBe('password');
    expect(toggle.getAttribute('aria-label')).toBe('Mostrar senha');
  });

  it('deixa o botão fora do label', async () => {
    const { root } = await setup();
    expect(root.querySelector('label .password-toggle')).toBeNull();
    expect(root.querySelector('label')!.textContent).toBe('Senha');
  });
});
