import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { NightCallComponent } from './night-call.component';

describe('Filtro de quarto na chamada da demonstração', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(DemoSessionService).activate('supervisor');
  });

  it('mostra a marcação do sistema com a saída e o aviso, e some ao corrigir', async () => {
    const fixture = TestBed.createComponent(NightCallComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('já entram como ausência justificada');
    const link = element.querySelector<HTMLAnchorElement>('a[href="/saidas/S-1047"]');
    expect(link?.textContent).toContain('saída curta');
    expect(link?.closest('p')?.textContent).toContain('Sistema');
    fixture.componentInstance.mark('res-002', 'Presente');
    await fixture.whenStable();
    expect(element.querySelector('a[href="/saidas/S-1047"]')).toBeNull();
    expect(element.textContent).not.toContain('já entram como ausência justificada');
  });

  it('oferece só quartos do bloco escolhido e limpa o quarto ao trocar de bloco', async () => {
    const fixture = TestBed.createComponent(NightCallComponent);
    const component = fixture.componentInstance;
    expect(component.roomOptions()).toEqual(['A-102', 'A-104', 'B-201', 'B-203']);
    component.room.setValue('A-104');
    await fixture.whenStable();
    expect(component.filtered().map((resident) => resident.room)).toEqual(['A-104']);
    component.block.setValue('B');
    await fixture.whenStable();
    expect(component.room.value).toBe('');
    expect(component.roomOptions()).toEqual(['B-201', 'B-203']);
    expect(component.filtered().map((resident) => resident.room)).toEqual(['B-201', 'B-203']);
    const select = Array.from<HTMLLabelElement>(fixture.nativeElement.querySelectorAll('label'))
      .find((label) => label.textContent?.trim().startsWith('Quarto'))
      ?.querySelector('select');
    expect(Array.from(select?.options ?? []).map((option) => option.textContent?.trim())).toEqual([
      'Todos os quartos',
      'B-201',
      'B-203',
    ]);
  });
});
