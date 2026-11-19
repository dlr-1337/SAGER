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
  reportMetrics,
  reportMonthlySeries,
  summaryMetrics,
} from './reports-local.utils';
import { DEMO_COLUMNS, ReportsDemoApiService } from './reports-demo-api.service';
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
  it('mostra no resumo só as métricas que o relatório traz', () => {
    expect(
      summaryMetrics({ totalRows: 2, countsByStatus: { APROVADA: 2 }, confirmedLateReturns: 1 }),
    ).toEqual([{ key: 'confirmedLateReturns', label: 'Voltaram atrasados', value: '1' }]);
    expect(
      summaryMetrics({ totalRows: 1, countsByStatus: {}, cleaningMean: 8.5 }).map((m) => m.value),
    ).toEqual(['8,50']);
    expect(summaryMetrics({ totalRows: 1, countsByStatus: { EMITIDO: 1 } })).toEqual([]);
    expect(reportMetrics.SAIDAS).toEqual(['confirmedLateReturns']);
    expect(reportMetrics.CONSOLIDADO).toHaveLength(4);
  });
  it('mês a mês conta os registros e a métrica do relatório; o consolidado mantém as três listas', () => {
    const exits = reportMonthlySeries('SAIDAS', {
      totalRows: 3,
      countsByStatus: {},
      confirmedLateReturns: 1,
    });
    expect(exits.map((series) => series.key)).toEqual(['totalRows', 'confirmedLateReturns']);
    expect(exits.map((series) => series.label)).not.toContain('Registros');
    expect(
      reportMonthlySeries('LIMPEZA', { totalRows: 1, countsByStatus: {}, cleaningMean: 8 }).map(
        (series) => series.key,
      ),
    ).toEqual(['totalRows']);
    expect(reportMonthlySeries('CONSOLIDADO', { totalRows: 0, countsByStatus: {} })).toHaveLength(
      3,
    );
    const chart = new MonthlyIndicatorsComponent();
    chart.seriesList = exits;
    chart.items = [{ month: '2026-09', totalRows: 5, confirmedLateReturns: 1 }];
    expect(chart.maximum()).toBe(5);
    expect(chart.value(chart.items[0], 'activeWarnings')).toBe(0);
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
describe('Demonstração com as mesmas colunas, métricas e ordem', () => {
  function demo() {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DemoSessionService,
          useValue: { active: signal(true), scenario: signal('padrao') },
        },
      ],
    });
    return TestBed.inject(ReportsDemoApiService);
  }
  const september = { from: '2026-09-01', to: '2026-09-30' };
  const labels = (columns: { label: string }[]) => columns.map((column) => column.label);
  it('saídas sem nota de limpeza, com o tipo de saída e quem voltou atrasado', async () => {
    const api = demo();
    const catalog = await api.catalog();
    expect(catalog.version).toBe(2);
    expect(labels(catalog.items.find((item) => item.code === 'SAIDAS')!.columns)).toEqual([
      'Data',
      'Residente',
      'Quarto',
      'Tipo de saída',
      'Situação',
    ]);
    const exits = await api.create({
      catalogCode: 'SAIDAS',
      filters: september,
      idempotencyKey: 'k1',
    });
    expect(exits.summary.confirmedLateReturns).toBe(1);
    for (const key of ['cleaningMean', 'unjustifiedAbsences', 'activeWarnings', 'countsByType'])
      expect(exits.summary).not.toHaveProperty(key);
    expect(exits.monthly[0]).not.toHaveProperty('cleaningMean');
    const presence = await api.create({
      catalogCode: 'PRESENCA',
      filters: september,
      idempotencyKey: 'k2',
    });
    expect(labels(presence.columns)).toEqual(['Data', 'Residente', 'Quarto', 'Situação']);
    expect(presence.summary.unjustifiedAbsences).toBe(1);
    expect(presence.summary).not.toHaveProperty('cleaningMean');
  });
  it('consolidado traz tudo, do registro mais recente para o mais antigo', async () => {
    const api = demo();
    const all = await api.create({
      catalogCode: 'CONSOLIDADO',
      filters: september,
      idempotencyKey: 'k3',
    });
    expect(labels(all.columns)).toEqual(labels(DEMO_COLUMNS.CONSOLIDADO));
    expect(all.columns).toHaveLength(8);
    for (const key of [
      'cleaningMean',
      'unjustifiedAbsences',
      'confirmedLateReturns',
      'activeWarnings',
      'countsByType',
    ])
      expect(all.summary).toHaveProperty(key);
    const dates = (await api.rows(all.id)).items.map((row) => row.date);
    expect(dates[0]).toBe('2026-09-24');
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
