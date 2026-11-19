import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { RankingComponent } from './ranking.component';

describe('Ranking da demonstração', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  const open = async (role: 'gestor' | 'residente') => {
    TestBed.inject(DemoSessionService).activate(role);
    const fixture = TestBed.createComponent(RankingComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const rows = () =>
      Array.from(element.querySelectorAll('.op-ranking-list li')).map((row) => row.textContent);
    return { fixture, element, rows };
  };

  it('abre nos últimos 5 dias, com semana, mês e semestre como opções', async () => {
    const { element } = await open('gestor');
    const buttons = Array.from(element.querySelectorAll('.op-periods button'));
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Últimos 5 dias',
      'Semanal',
      'Mensal',
      'Semestral',
    ]);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('#ranking-title')?.textContent).toContain(
      'Classificação dos últimos 5 dias',
    );
    expect(element.textContent).toContain('últimos 5 dias');
  });

  it('mostra posição e nota com duas casas, empate repetido e quarto sem nota', async () => {
    const { rows } = await open('gestor');
    expect(rows()).toHaveLength(4);
    expect(rows()[0]).toContain('1ª posição');
    expect(rows()[0]).toContain('8,50');
    expect(rows()[1]).toContain('1ª posição');
    expect(rows()[2]).toContain('3ª posição');
    expect(rows()[2]).toContain('7,25');
    expect(rows()[3]).toContain('Sem posição');
    expect(rows()[3]).toContain('Sem nota');
    expect(rows().join(' ')).not.toMatch(/avalia/i);
  });

  it('para o residente, mostra só a nota do próprio quarto', async () => {
    const { element } = await open('residente');
    const scores = Array.from(element.querySelectorAll('.op-rank-score'));
    expect(scores).toHaveLength(1);
    expect(scores[0].closest('li')?.textContent).toContain('Seu quarto');
    expect(scores[0].textContent?.trim()).toBe('8,50');
  });
});
