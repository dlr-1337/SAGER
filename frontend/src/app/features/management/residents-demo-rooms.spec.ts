import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { CourseApiService } from './course-api.service';
import { ManagementDemoService } from './management-demo.service';
import { ResidentsComponent } from './residents.component';

describe('Quarto dependente do bloco nos residentes da demonstração', () => {
  it('oferece só quartos do bloco escolhido e limpa o quarto ao trocar', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(DemoSessionService).activate('gestor');
    vi.spyOn(TestBed.inject(CourseApiService), 'list').mockResolvedValue([]);
    const fixture = TestBed.createComponent(ResidentsComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const { accommodationId, roomId } = component.filters.controls;
    const all = component.demoRooms();
    expect(new Set(all.map((room) => room.block)).size).toBeGreaterThan(1);
    roomId.setValue(all.find((room) => room.block !== 'A')!.id);
    accommodationId.setValue('A');
    await fixture.whenStable();
    expect(roomId.value).toBe('');
    expect(component.demoRooms().length).toBeGreaterThan(0);
    expect(component.demoRooms().every((room) => room.block === 'A')).toBe(true);
    const select = Array.from<HTMLLabelElement>(fixture.nativeElement.querySelectorAll('label'))
      .find((label) => label.textContent?.trim().startsWith('Quarto'))
      ?.querySelector('select');
    expect(select?.options.length).toBe(component.demoRooms().length + 1);
  });

  async function roomOptions(): Promise<string[]> {
    const fixture = TestBed.createComponent(ResidentsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    return [
      ...fixture.nativeElement.querySelectorAll('select[formcontrolname="roomId"] option'),
    ].map((option: HTMLOptionElement) => option.textContent!.trim());
  }

  it('sem bloco escolhido, os quartos seguem bloco, piso e número', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(DemoSessionService).activate('gestor');
    vi.spyOn(TestBed.inject(CourseApiService), 'list').mockResolvedValue([]);
    const options = await roomOptions();
    expect(options.indexOf('A · 202')).toBeLessThan(options.indexOf('B · 201'));
    // Térreo antes do 1º piso, como na grade, mesmo sem o piso no rótulo.
    expect(options.indexOf('B · 301')).toBeLessThan(options.indexOf('B · 201'));
  });

  it('quarto salvo na demonstração entra na ordem natural', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(DemoSessionService).activate('gestor');
    vi.spyOn(TestBed.inject(CourseApiService), 'list').mockResolvedValue([]);
    TestBed.inject(ManagementDemoService).saveRoom({
      number: '105',
      block: 'A',
      floor: 'Térreo',
      situation: 'Disponível',
    });
    const options = await roomOptions();
    expect(options.indexOf('A · 105')).toBeGreaterThan(0);
    expect(options.indexOf('A · 105')).toBeLessThan(options.indexOf('A · 202'));
    expect(options.indexOf('A · 105')).toBeLessThan(options.indexOf('B · 201'));
  });

  it('carrega os cursos da memória sem chamar a API e sem aviso de opções', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(DemoSessionService).activate('gestor');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      const fixture = TestBed.createComponent(ResidentsComponent);
      await fixture.whenStable();
      expect(fixture.componentInstance.courses().length).toBeGreaterThan(0);
      expect(fixture.componentInstance.optionsError()).toBe('');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
