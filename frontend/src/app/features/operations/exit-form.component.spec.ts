import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { ExitFormComponent } from './exit-form.component';

describe('Formulário de saída da demonstração', () => {
  async function create() {
    TestBed.configureTestingModule({
      imports: [ExitFormComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) },
          },
        },
        {
          provide: DemoSessionService,
          useValue: { active: signal(true), hasRole: (role: string) => role === 'residente' },
        },
      ],
    });
    const fixture = TestBed.createComponent(ExitFormComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const inputs = root.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    const type = async (input: HTMLInputElement, value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await fixture.whenStable();
    };
    return {
      fixture,
      root,
      departure: inputs[0],
      expectedReturn: inputs[1],
      type,
      async kind(value: 'Curta' | 'Longa') {
        root.querySelector<HTMLInputElement>(`input[value="${value}"]`)!.click();
        await fixture.whenStable();
      },
    };
  }

  it('sugere 3 h na curta e 4 h na longa enquanto o retorno não foi editado', async () => {
    const form = await create();
    await form.type(form.departure, '2030-05-10T14:00');
    expect(form.expectedReturn.value).toBe('2030-05-10T17:00');
    await form.kind('Longa');
    expect(form.expectedReturn.value).toBe('2030-05-10T18:00');
    await form.kind('Curta');
    expect(form.expectedReturn.value).toBe('2030-05-10T17:00');
  });

  it('preserva edição válida e anuncia o ajuste da que saiu do limite', async () => {
    const form = await create();
    await form.type(form.departure, '2030-05-10T14:00');
    await form.type(form.expectedReturn, '2030-05-10T15:30');
    await form.type(form.departure, '2030-05-10T14:10');
    expect(form.expectedReturn.value).toBe('2030-05-10T15:30');
    await form.kind('Longa');
    expect(form.expectedReturn.value).toBe('2030-05-10T18:10');
    expect(form.root.querySelector('[role="status"]')!.textContent).toContain('não dava');
  });

  it('ignora ano parcial sem invalidar o retorno sugerido', async () => {
    const form = await create();
    await form.type(form.departure, '2030-05-10T14:00');
    await form.type(form.departure, '0202-05-10T14:00');
    expect(form.expectedReturn.value).toBe('');
    await form.type(form.departure, '2030-05-10T15:00');
    expect(form.expectedReturn.value).toBe('2030-05-10T18:00');
  });

  it('mostra duração e limites do tipo escolhido', async () => {
    const form = await create();
    await form.type(form.departure, '2030-05-10T14:00');
    await form.type(form.expectedReturn, '2030-05-10T16:30');
    expect(form.root.querySelector('#demo-exit-period-hint')!.textContent).toContain(
      'Duração: 2 h 30 min (máx. 3 h)',
    );
    expect(form.expectedReturn.max).toBe('2030-05-10T17:00');
    await form.type(form.expectedReturn, '2030-05-10T17:01');
    expect(form.root.querySelector('.op-field-error')!.textContent).toContain('3 horas');
  });

  it('recusa no envio saída longa de 3 h e indica o mínimo', async () => {
    const form = await create();
    await form.type(form.departure, '2030-05-10T14:00');
    await form.kind('Longa');
    await form.type(form.expectedReturn, '2030-05-10T17:00');
    const reason = form.root.querySelector<HTMLInputElement>('input[type="text"]')!;
    reason.value = 'Visita à família';
    reason.dispatchEvent(new Event('input', { bubbles: true }));
    form.root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await form.fixture.whenStable();
    expect(form.root.querySelector('[role="alert"]')!.textContent).toContain('mais de três horas');
  });
});
