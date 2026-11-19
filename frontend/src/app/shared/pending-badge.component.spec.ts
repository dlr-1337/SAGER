import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PendingBadgeComponent } from './pending-badge.component';

function render(count: number, announce = true) {
  const fixture = TestBed.createComponent(PendingBadgeComponent);
  fixture.componentRef.setInput('count', count);
  fixture.componentRef.setInput('announce', announce);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host,
    badge: () => host.querySelector<HTMLElement>('.pending-badge'),
    text: () => host.querySelector<HTMLElement>('.sr-only')?.textContent ?? null,
  };
}

describe('PendingBadgeComponent', () => {
  it('mostra o número, escondido do leitor de tela, e o texto lido junto do nome', () => {
    const { badge, text } = render(3);
    expect(badge()?.textContent?.trim()).toBe('3');
    expect(badge()?.getAttribute('aria-hidden')).toBe('true');
    expect(text()).toBe(', 3 pendentes');
  });

  it('usa o singular para 1', () => {
    expect(render(1).text()).toBe(', 1 pendente');
  });

  it('mostra "99+" acima de 99 e lê o número exato', () => {
    const { badge, text } = render(120);
    expect(badge()?.textContent?.trim()).toBe('99+');
    expect(text()).toBe(', 120 pendentes');
  });

  it('não desenha nada com zero e some quando a contagem zera', () => {
    const { fixture, host, badge } = render(0);
    expect(host.textContent?.trim()).toBe('');
    expect(badge()).toBeNull();
    fixture.componentRef.setInput('count', 2);
    fixture.detectChanges();
    expect(badge()).not.toBeNull();
    fixture.componentRef.setInput('count', 0);
    fixture.detectChanges();
    expect(badge()).toBeNull();
    expect(host.querySelector('.sr-only')).toBeNull();
  });

  it('sem announce mostra só o número, para o botão que lê a soma como descrição', () => {
    const { badge, text } = render(6, false);
    expect(badge()?.textContent?.trim()).toBe('6');
    expect(text()).toBeNull();
  });
});
