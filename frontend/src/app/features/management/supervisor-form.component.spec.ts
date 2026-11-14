import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';
import { SupervisorApiService } from './supervisor-api.service';
import { SupervisorFormComponent } from './supervisor-form.component';

const saved = {
  id: 's-9',
  name: 'Pessoa Sintética',
  institutionalId: 'TESTE-9',
  email: 'pessoa@example.invalid',
  version: 0,
};

async function setup(options: { demo?: boolean; role?: string; id?: string } = {}) {
  const save = vi.fn().mockResolvedValue(saved);
  const saveSupervisor = vi.fn().mockReturnValue(saved);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: SupervisorApiService, useValue: { save, get: async () => saved } },
      {
        provide: ManagementDemoService,
        useValue: { saveSupervisor, supervisor: () => saved },
      },
      {
        provide: DemoSessionService,
        useValue: {
          active: signal(!!options.demo),
          hasRole: (...roles: string[]) => roles.includes(options.role ?? 'gestor'),
        },
      },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: convertToParamMap(options.id ? { id: options.id } : {}) },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(SupervisorFormComponent);
  await fixture.whenStable();
  return { fixture, native: fixture.nativeElement as HTMLElement, save, saveSupervisor };
}

describe('e-mail do supervisor', () => {
  it('recusa no campo o domínio sem ponto, que o servidor também recusa', async () => {
    const { fixture, native, save } = await setup();
    fill(fixture);
    fixture.componentInstance.form.controls.email.setValue('joao@ifgoiano');
    native.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(save).not.toHaveBeenCalled();
    expect(native.querySelector('#supervisor-email-error')?.textContent).toContain(
      'Informe um e-mail válido',
    );
  });
});

function fill(fixture: ComponentFixture<SupervisorFormComponent>, password = 'Senha teste 123!') {
  fixture.componentInstance.form.setValue({
    name: 'Pessoa Sintética',
    institutionalId: 'TESTE-9',
    email: 'pessoa@example.invalid',
    password,
    passwordConfirmation: password,
  });
}

describe('SupervisorFormComponent', () => {
  it('recusa o supervisor, que não gerencia supervisores', async () => {
    const { native } = await setup({ role: 'supervisor' });
    expect(native.textContent).toContain('Acesso restrito');
    expect(native.querySelector('form')).toBeNull();
  });

  it('pede senha ao criar, explica o acesso e envia a senha à API', async () => {
    const { fixture, native, save } = await setup();
    expect(native.textContent).toContain('Usuário (usado para entrar) *');
    expect(native.textContent).toContain(
      'A pessoa entra no sistema com o usuário e a senha informados aqui.',
    );
    expect(native.textContent).not.toMatch(/matrícula|SIAPE/i);
    expect(native.querySelectorAll('sager-password-field')).toHaveLength(2);
    fill(fixture);
    await fixture.componentInstance.save();
    expect(save).toHaveBeenCalledWith(
      {
        name: 'Pessoa Sintética',
        institutionalId: 'TESTE-9',
        email: 'pessoa@example.invalid',
        password: 'Senha teste 123!',
        passwordConfirmation: 'Senha teste 123!',
      },
      undefined,
    );
  });

  it('mostra as regras no campo, com zero à esquerda e e-mail de qualquer provedor', async () => {
    const { fixture, native, save } = await setup();
    expect(native.querySelector('#supervisor-email-hint')!.textContent).toContain(
      '@ifgoiano.edu.br',
    );
    const form = fixture.componentInstance.form;
    fill(fixture);
    form.controls.name.setValue('Ana');
    form.controls.institutionalId.setValue('abc');
    native.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
    expect(native.querySelector('#supervisor-name-error')!.textContent).toBe(
      'Digite o nome completo, como no documento.',
    );
    expect(native.querySelector('#supervisor-id-error')!.textContent).toBe(
      'Use de 4 a 20 letras, números ou hífen.',
    );
    expect(save).not.toHaveBeenCalled();
    fill(fixture);
    form.controls.institutionalId.setValue('0123456');
    form.controls.email.setValue('pessoa@gmail.com');
    await fixture.componentInstance.save();
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ institutionalId: '0123456', email: 'pessoa@gmail.com' }),
      undefined,
    );
  });

  it('bloqueia senha fraca, igual ao usuário, diferente da confirmação e login com @', async () => {
    const { fixture, native, save } = await setup();
    const form = fixture.componentInstance.form;
    for (const [id, value, message] of [
      ['TESTE-9', 'curta', 'A senha precisa ter pelo menos 8 letras ou números.'],
      ['TESTE-9', '12345678', 'Essa senha é fácil demais. Escolha outra.'],
      ['TESTE-99', 'teste-99', 'A senha não pode ser igual ao usuário.'],
    ]) {
      fill(fixture, value);
      form.controls.institutionalId.setValue(id);
      expect(form.controls.password.errors?.['passwordRules']).toBe(message);
      await fixture.componentInstance.save();
    }
    fill(fixture);
    form.controls.passwordConfirmation.setValue('Outra senha 456!');
    await fixture.componentInstance.save();
    await fixture.whenStable();
    expect(native.querySelector('[role="alert"]')?.textContent).toBe(
      'Repita a mesma senha nos dois campos.',
    );
    fill(fixture);
    form.controls.institutionalId.setValue('pessoa@campus');
    await fixture.componentInstance.save();
    expect(form.controls.institutionalId.invalid).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it('na edição não mostra nem envia senha', async () => {
    const { fixture, native, save } = await setup({ id: saved.id });
    await fixture.whenStable();
    expect(native.querySelector('sager-password-field')).toBeNull();
    expect(native.textContent).toContain('Esta tela não muda a senha.');
    await fixture.componentInstance.save();
    expect(save).toHaveBeenCalledWith(
      { name: saved.name, institutionalId: saved.institutionalId, email: saved.email },
      { id: saved.id, version: saved.version },
    );
  });

  it('na demonstração exige a senha, mas não a guarda', async () => {
    const { fixture, native, saveSupervisor } = await setup({ demo: true });
    expect(native.textContent).toContain('Nesta demonstração, a senha não é guardada.');
    await fixture.componentInstance.save();
    expect(saveSupervisor).not.toHaveBeenCalled();
    fill(fixture);
    await fixture.componentInstance.save();
    expect(saveSupervisor).toHaveBeenCalledWith(
      { name: 'Pessoa Sintética', institutionalId: 'TESTE-9', email: 'pessoa@example.invalid' },
      undefined,
    );
  });
});
