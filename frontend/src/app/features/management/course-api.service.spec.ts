import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession } from '../../core/api';
import { DemoSessionService } from '../../core/demo-session.service';
import { Course, CourseApiService } from './course-api.service';

const course: Course = { id: 'curso-1', name: 'Curso Sintético', active: true, version: 0 };

describe('CourseApiService', () => {
  beforeEach(() => {
    resetSession();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('reaproveita a lista da conta por 60 s e pede de novo depois de gravar ou de trocar a sessão', async () => {
    TestBed.inject(DemoSessionService).deactivate();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/v1/auth/csrf')
        return new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' }));
      return new Response(JSON.stringify(init?.method === 'GET' ? [course] : course));
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = TestBed.inject(CourseApiService);
    const reads = () =>
      fetchMock.mock.calls.filter(
        ([url, init]) => url === '/api/v1/cursos' && init?.method === 'GET',
      ).length;
    expect(await service.list()).toEqual([course]);
    expect(await service.list()).toEqual([course]);
    expect(reads()).toBe(1);
    await service.save({ name: 'Outro Curso', level: null, durationYears: null });
    await service.list();
    expect(reads()).toBe(2);
    resetSession();
    await service.list();
    expect(reads()).toBe(3);
  });

  it('na demonstração, o curso salvo aparece na lista sem pedir nada à API', async () => {
    TestBed.inject(DemoSessionService).activate('gestor');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = TestBed.inject(CourseApiService);
    await service.list();
    await service.save({ name: 'Curso Novo da Demonstração', level: null, durationYears: null });
    expect((await service.list()).map((item) => item.name)).toContain('Curso Novo da Demonstração');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
