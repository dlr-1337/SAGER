import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { ReportsDemoApiService } from './reports-demo-api.service';
import { ReportsLocalPage } from './reports-local.pages';

async function settle(fixture: { whenStable(): Promise<unknown> }) {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}
function button(root: HTMLElement, name: string): HTMLButtonElement | undefined {
  return [...root.querySelectorAll('button')].find((item) => item.textContent?.includes(name));
}

describe('Relatórios na demonstração', () => {
  const fetchSpy = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(DemoSessionService).activate('gestor');
  });
  afterEach(() => {
    TestBed.inject(DemoSessionService).deactivate();
    vi.unstubAllGlobals();
  });

  it('gera com um clique, mostra andamento e não baixa arquivo nem chama a API', async () => {
    const fixture = TestBed.createComponent(ReportsLocalPage);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.report-range')?.textContent).toContain('01/09/2026 a 30/09/2026');
    expect(root.querySelectorAll('.report-type')).toHaveLength(8);
    button(root, 'Gerar relatório')!.click();
    button(root, 'Buscando')?.click();
    await settle(fixture);
    expect(root.querySelectorAll('.report-card')).toHaveLength(1);
    expect(root.querySelector('.report-card [role=status]')?.textContent).toContain('Montando');

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 5000);
    await fixture.componentInstance.list.refresh();
    await settle(fixture);
    vi.restoreAllMocks();
    expect(button(root, 'Baixar PDF')).toBeTruthy();
    expect(button(root, 'Baixar planilha Excel')).toBeTruthy();
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL');
    button(root, 'Baixar PDF')!.click();
    await settle(fixture);
    expect(root.textContent).toContain('Na demonstração nenhum arquivo é baixado.');
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('sem registros orienta a mudar o período e nenhum arquivo é preparado', async () => {
    const fixture = TestBed.createComponent(ReportsLocalPage);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    const prepare = vi.spyOn(TestBed.inject(ReportsDemoApiService), 'requestExport');
    fixture.componentInstance.form.patchValue({ period: 'mes-passado' });
    fixture.componentInstance.applyPeriod();
    button(root, 'Gerar relatório')!.click();
    await settle(fixture);
    expect(root.textContent).toContain('Não encontramos registros nesse período');
    expect(root.querySelectorAll('.report-card')).toHaveLength(0);
    expect(prepare).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('filtros ativos aparecem e podem ser removidos, inclusive em cascata', async () => {
    const fixture = TestBed.createComponent(ReportsLocalPage);
    await settle(fixture);
    const page = fixture.componentInstance;
    const unit = page.housing().units[0];
    page.form.patchValue({
      accommodationId: unit.accommodationId,
      unitId: unit.id,
      roomId: page.housing().rooms.find((room) => room.unitId === unit.id)!.id,
    });
    expect(page.activeFilters().map((item) => item.label)).toContain('Bloco A');
    page.removeFilter('unitId');
    expect(page.form.controls.roomId.value).toBe('');
    expect(page.activeFilters().map((item) => item.key)).toEqual(['accommodationId']);
    page.clearFilters();
    expect(page.activeFilters()).toEqual([]);
    fixture.destroy();
  });

  it('cenário de erro mostra a falha e "Tentar novamente" volta ao padrão', async () => {
    const session = TestBed.inject(DemoSessionService);
    session.setScenario('erro');
    const fixture = TestBed.createComponent(ReportsLocalPage);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Registros indisponíveis');
    button(root, 'Tentar novamente')!.click();
    await settle(fixture);
    expect(session.scenario()).toBe('padrao');
    expect(button(root, 'Gerar relatório')).toBeTruthy();
    fixture.destroy();
  });

  it('linhas da demonstração vêm em páginas de 25, como no acesso por conta', async () => {
    const api = TestBed.inject(ReportsDemoApiService);
    const snapshot = await api.create({
      catalogCode: 'CONSOLIDADO',
      filters: { from: '2026-09-01', to: '2026-09-30' },
      idempotencyKey: 'demo-paginas',
    });
    expect((await api.rows(snapshot.id)).limit).toBe(25);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
