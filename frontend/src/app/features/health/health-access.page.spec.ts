import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { ResidentApiService } from '../management/resident-api.service';
import { HealthAccessPage } from './health-access.page';
import { HealthApiService } from './health-api.service';

describe('Estado dos formulários após gravar acessos de saúde', () => {
  let fixture: ComponentFixture<HealthAccessPage>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  beforeEach(async () => {
    const empty = { items: [], nextCursor: null, totalCount: 0 };
    api = {
      getMe: vi.fn(() =>
        of({ professionalGrant: null, canAdministerAccess: true, canAccessOwnRecord: false }),
      ),
      accounts: vi.fn().mockResolvedValue(empty),
      grants: vi.fn().mockResolvedValue(empty),
      assignments: vi.fn().mockResolvedValue(empty),
      custodies: vi.fn().mockResolvedValue(empty),
      noteAuthors: vi.fn().mockResolvedValue([]),
      createGrant: vi.fn().mockResolvedValue({}),
      createAssignment: vi.fn().mockResolvedValue({}),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: HealthApiService, useValue: api },
        { provide: ResidentApiService, useValue: { list: vi.fn().mockResolvedValue([]) } },
        { provide: DemoSessionService, useValue: { active: signal(false) } },
      ],
    });
    fixture = TestBed.createComponent(HealthAccessPage);
    await fixture.whenStable();
  });

  function prepare(kind: 'grant' | 'assignment') {
    const component = fixture.componentInstance;
    component.residentId.setValue('00000000-0000-4000-8000-000000000041');
    if (kind === 'grant')
      component.grantForm.setValue({
        accountId: '00000000-0000-4000-8000-000000000001',
        profession: 'MEDICINA',
        registrationNumber: 'TESTE-1',
        registrationRegion: 'GO',
        verificationReason: 'Conferência sintética de documentos',
      });
    else
      component.assignmentForm.setValue({
        professionalGrantId: '00000000-0000-4000-8000-000000000071',
        reason: 'Vínculo assistencial sintético',
      });
    const form = kind === 'grant' ? component.grantForm : component.assignmentForm;
    for (const control of Object.values(form.controls)) control.markAsDirty();
    const save = () => (kind === 'grant' ? component.createGrant() : component.createAssignment());
    return { form, save };
  }

  it.each(['grant', 'assignment'] as const)(
    'marca %s como salvo após confirmação',
    async (kind) => {
      const { form, save } = prepare(kind);
      await save();
      expect(form.pristine).toBe(true);
      expect(fixture.componentInstance.success()).not.toBe('');
      if (kind === 'grant')
        expect(fixture.componentInstance.grantForm.controls.registrationNumber.value).toBe(
          'TESTE-1',
        );
      else expect(fixture.componentInstance.assignmentForm.controls.reason.value).toBe('');
    },
  );

  it.each(['grant', 'assignment'] as const)(
    'mantém %s sujo e preenchido quando a gravação falha',
    async (kind) => {
      const { form, save } = prepare(kind);
      const before = form.getRawValue();
      api[kind === 'grant' ? 'createGrant' : 'createAssignment'].mockRejectedValueOnce(
        new Error('503'),
      );
      await save();
      expect(form.dirty).toBe(true);
      expect(form.getRawValue()).toEqual(before);
      expect(fixture.componentInstance.error()).not.toBe('');
    },
  );

  it.each(['grant', 'assignment'] as const)(
    'mantém %s salvo se a atualização da lista falhar',
    async (kind) => {
      const { form, save } = prepare(kind);
      let pristineAtRefresh: boolean | undefined;
      api[kind === 'grant' ? 'grants' : 'assignments'].mockImplementationOnce(async () => {
        pristineAtRefresh = form.pristine;
        throw new Error('falha ao atualizar a lista');
      });
      await save();
      expect(pristineAtRefresh).toBe(true);
      expect(form.pristine).toBe(true);
      expect(fixture.componentInstance.error()).not.toBe('');
    },
  );
});
