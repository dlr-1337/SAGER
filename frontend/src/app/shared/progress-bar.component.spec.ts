import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ProgressBarComponent } from './progress-bar.component';

function render(done: number, total: number) {
  const fixture = TestBed.createComponent(ProgressBarComponent);
  fixture.componentRef.setInput('done', done);
  fixture.componentRef.setInput('total', total);
  fixture.componentRef.setInput('noun', 'marcações registradas');
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  return { host, fill: host.querySelector('span') as HTMLElement };
}

describe('ProgressBarComponent', () => {
  it('descreve o progresso em texto e preenche a proporção', () => {
    const { host, fill } = render(3, 4);
    expect(host.getAttribute('role')).toBe('img');
    expect(host.getAttribute('aria-label')).toBe('3 de 4 marcações registradas');
    expect(fill.style.width).toBe('75%');
  });

  it('fica vazia quando o total é zero', () => {
    const { host, fill } = render(0, 0);
    expect(host.getAttribute('aria-label')).toBe('0 de 0 marcações registradas');
    expect(fill.style.width).toBe('0%');
  });
});
