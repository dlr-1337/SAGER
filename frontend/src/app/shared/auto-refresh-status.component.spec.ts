import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AutoRefreshStatusComponent } from './auto-refresh-status.component';

function render() {
  const refresh = {
    state: signal<'running' | 'paused'>('running'),
    failed: signal(false),
    resume: vi.fn(),
  };
  const fixture = TestBed.createComponent(AutoRefreshStatusComponent);
  fixture.componentRef.setInput('refresh', refresh);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const status = element.querySelector('[role="status"]') as HTMLElement;
  return { fixture, refresh, status };
}

describe('Aviso da atualização automática', () => {
  it('não mostra nada enquanto atualiza normalmente', () => {
    const { status } = render();
    expect(status.textContent?.trim()).toBe('');
  });

  it('pausada, mostra "Atualização pausada" e "Retomar" chama resume()', () => {
    const { fixture, refresh, status } = render();
    refresh.state.set('paused');
    fixture.detectChanges();
    expect(status.textContent).toContain('Atualização pausada');
    const button = status.querySelector('button') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Retomar');
    button.click();
    expect(refresh.resume).toHaveBeenCalledTimes(1);
  });

  it('com falha, mostra a linha discreta na mesma região de status', () => {
    const { fixture, refresh, status } = render();
    refresh.failed.set(true);
    fixture.detectChanges();
    expect(status.textContent?.trim()).toBe(
      'Não foi possível atualizar. A tela tenta de novo sozinha.',
    );
    expect(status.querySelector('button')).toBeNull();
  });
});
