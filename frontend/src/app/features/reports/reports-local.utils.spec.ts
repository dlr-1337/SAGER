import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import {
  ReportListPolling,
  normalizedReportInput,
  periodError,
  periodPreset,
  reportCell,
  reportFileName,
} from './reports-local.utils';
import { ReportExport, ReportListItem, ReportRow } from './reports-local.models';
import { ReportingApiError } from '../cleaning/reporting-local.transport';
import { MonthlyIndicatorsComponent } from '../cleaning/monthly-indicators.component';
describe('Recortes e indicadores de relatórios', () => {
  it('conta intervalo inclusivo em dias civis e rejeita datas impossíveis e mais de 366 dias', () => {
    expect(periodError('2024-01-01', '2024-12-31')).toBe('');
    expect(periodError('2024-01-01', '2025-01-01')).toContain('366');
    expect(periodError('2026-02-29', '2026-03-01')).toContain('válidas');
    expect(periodError('2026-10-01', '2026-09-30')).toContain('anteceder');
  });
  it('omite filtros vazios e conserva identificadores e status do catálogo selecionado', () => {
    expect(
      normalizedReportInput('TERMOS', {
        from: '2026-09-01',
        to: '2026-09-30',
        accommodationId: '',
        unitId: '',
        roomId: '',
        residentId: 'uuid',
        status: 'EMITIDO',
      }),
    ).toEqual({
      catalogCode: 'TERMOS',
      filters: { from: '2026-09-01', to: '2026-09-30', residentId: 'uuid', status: 'EMITIDO' },
    });
  });
  it('usa a mesma medida de barra, com zero estável, e mantém contagens distintas sem pontuação derivada', () => {
    const chart = new MonthlyIndicatorsComponent();
    expect(chart.maximum()).toBe(1);
    chart.items = [
      { month: '2026-09', unjustifiedAbsences: 0, confirmedLateReturns: 3, activeWarnings: 8 },
    ];
    expect(chart.maximum()).toBe(8);
    expect(chart.seriesList).toHaveLength(3);
    expect(chart.month('2026-09')).toBe('09/2026');
  });
  it('apresenta ausências de nota como ausência e usa os estados e origens reais', () => {
    const row = { status: 'EMITIDO', score: null, sourceType: 'CLEANING_ASSESSMENT' } as ReportRow;
    expect(reportCell(row, 'score')).toBe('Não informado');
    expect(reportCell(row, 'status')).toBe('Termo emitido');
    expect(reportCell(row, 'sourceType')).toBe('Avaliação de limpeza');
  });
});
const item = (status: ReportExport['status'] = 'PENDING'): ReportListItem => ({
  id: 'r1',
  catalogCode: 'PRESENCA',
  filters: {
    from: '2026-10-01',
    to: '2026-10-31',
    accommodationId: null,
    roomId: null,
    residentId: null,
    status: null,
  },
  rowCount: 1,
  asOf: '2026-10-31T10:00:00Z',
  expiresAt: '2026-11-01T10:00:00Z',
  exports: [{ id: 'j1', status } as ReportExport],
});
describe('Períodos e nome do arquivo', () => {
  it('calcula os atalhos pela data informada, inclusive na virada do ano', () => {
    expect(periodPreset('este-mes', '2026-10-31')).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(periodPreset('mes-passado', '2026-03-15')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(periodPreset('mes-passado', '2026-01-10')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
    expect(periodPreset('ultimos-7-dias', '2026-03-03')).toEqual({
      from: '2026-02-25',
      to: '2026-03-03',
    });
  });
  it('indica tipo e período no nome do arquivo', () => {
    expect(reportFileName(item(), 'PDF')).toBe('relatorio-presenca-2026-10-01-a-2026-10-31.pdf');
    expect(reportFileName(item(), 'XLSX')).toBe('relatorio-presenca-2026-10-01-a-2026-10-31.xlsx');
  });
});
describe('Consulta automática da lista', () => {
  afterEach(() => vi.useRealTimers());
  function polling(load: () => Promise<ReportListItem[]>, demo = false) {
    TestBed.configureTestingModule({
      providers: [{ provide: DemoSessionService, useValue: { active: signal(demo) } }],
    });
    return TestBed.runInInjectionContext(() => new ReportListPolling(load));
  }
  it('sem preparo, consulta aos 15 s e não aos 3 s', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockResolvedValue([item('READY')]);
    await polling(load).refresh();
    await vi.advanceTimersByTimeAsync(3000);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(12000);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('com preparo, consulta a cada 3 s e volta aos 15 s quando fica pronto', async () => {
    vi.useFakeTimers();
    const load = vi
      .fn()
      .mockResolvedValueOnce([item('PENDING')])
      .mockResolvedValueOnce([item('PROCESSING')])
      .mockResolvedValue([item('READY')]);
    const list = polling(load);
    await list.refresh();
    await vi.advanceTimersByTimeAsync(3000);
    expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3000);
    expect(load).toHaveBeenCalledTimes(3);
    expect(list.items()[0].exports[0].status).toBe('READY');
    await vi.advanceTimersByTimeAsync(9000);
    expect(load).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(6000);
    expect(load).toHaveBeenCalledTimes(4);
  });
  it('com a aba oculta não consulta, nem com preparo', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    try {
      const load = vi.fn().mockResolvedValue([item('PENDING')]);
      await polling(load).refresh();
      await vi.advanceTimersByTimeAsync(30000);
      expect(load).toHaveBeenCalledTimes(1);
    } finally {
      delete (document as { hidden?: boolean }).hidden;
    }
  });
  it('stop() encerra as consultas ao sair da tela', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockResolvedValue([item('PENDING')]);
    const list = polling(load);
    await list.refresh();
    list.stop();
    await vi.advanceTimersByTimeAsync(30000);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('falha automática mantém a lista com o aviso comum; falha pedida mostra o erro', async () => {
    vi.useFakeTimers();
    const load = vi
      .fn()
      .mockResolvedValueOnce([item('PENDING')])
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValueOnce([item('READY')])
      .mockRejectedValue(new ReportingApiError(403));
    const list = polling(load);
    await list.refresh();
    await vi.advanceTimersByTimeAsync(3000);
    expect(list.items()).toHaveLength(1);
    expect(list.error()).toBe('');
    expect(list.auto.failed()).toBe(true);
    await vi.advanceTimersByTimeAsync(3000);
    expect(list.auto.failed()).toBe(false);
    await list.refresh();
    expect(list.error()).toContain('Sua conta não pode');
  });
  it('com a consulta falhando e sem preparo, tenta de novo aos 15 s e não a cada 3 s', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockRejectedValue(new Error('rede'));
    const list = polling(load);
    await list.refresh();
    await vi.advanceTimersByTimeAsync(12000);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(12000);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('na demonstração acompanha só o preparo simulado, sem a atualização automática', async () => {
    vi.useFakeTimers();
    const load = vi
      .fn()
      .mockResolvedValueOnce([item('PENDING')])
      .mockResolvedValue([item('READY')]);
    await polling(load, true).refresh();
    await vi.advanceTimersByTimeAsync(60000);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('avisa da demora só depois de 2 minutos e esquece quando o preparo recomeça', async () => {
    vi.useFakeTimers();
    let status: ReportExport['status'] = 'PENDING';
    const list = polling(async () => [item(status)]);
    await list.refresh();
    await vi.advanceTimersByTimeAsync(117000);
    expect(list.slow().has('r1')).toBe(false);
    await vi.advanceTimersByTimeAsync(6000);
    expect(list.slow().has('r1')).toBe(true);
    status = 'FAILED';
    await vi.advanceTimersByTimeAsync(3000);
    expect(list.slow().has('r1')).toBe(false);
    status = 'PENDING';
    await list.refresh();
    expect(list.slow().has('r1')).toBe(false);
    list.stop();
  });
});
