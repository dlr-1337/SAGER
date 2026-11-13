import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { SessionService } from '../../core/session.service';
import { CourseApiService } from './course-api.service';
import { ResidentsComponent } from './residents.component';

describe('Quarto dependente do bloco nos residentes da demonstração', () => {
  it('oferece só quartos do bloco escolhido e limpa o quarto ao trocar', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(SessionService).activate('gestor');
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
});
