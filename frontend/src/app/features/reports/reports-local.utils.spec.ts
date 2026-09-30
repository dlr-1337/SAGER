import { describe, expect, it } from 'vitest';
import { normalizedReportInput, periodError, reportCell } from './reports-local.utils';
import { ReportRow } from './reports-local.models';
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
        roomId: '',
        residentId: 'uuid',
        status: 'EMITIDO',
      }),
    ).toEqual({
      catalogCode: 'TERMOS',
      filters: { from: '2026-09-01', to: '2026-09-30', residentId: 'uuid', status: 'EMITIDO' },
    });
  });
  it('usa uma escala comum com zero estável e mantém contagens distintas sem pontuação derivada', () => {
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
