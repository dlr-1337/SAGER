import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, HealthApiService } from './health-api.service';
import { HealthNoteDetailComponent } from './health-note-detail.component';
import { HealthNote, categoriesFor } from './health.models';

const note: HealthNote = {
  id: '00000000-0000-4000-8000-000000000061',
  sequence: 1,
  residentId: '00000000-0000-4000-8000-000000000041',
  category: 'GENERAL',
  authorAccountId: '00000000-0000-4000-8000-000000000001',
  authorName: 'Profissional Sintético',
  authorProfession: 'MEDICINA',
  authorRegistrationNumber: 'TESTE-1',
  authorRegistrationRegion: 'GO',
  createdAt: '2026-09-30T12:00:00Z',
  updatedAt: '2026-09-30T12:00:00Z',
  version: 0,
  relatedNoteId: null,
  canCorrect: true,
  canShare: true,
  custodyAccess: false,
  body: 'Atendimento sintético',
  shares: [],
};

async function setup(record = note, own = false) {
  const api = {
    note: vi.fn().mockResolvedValue(record),
    history: vi.fn().mockResolvedValue({ items: [], nextCursor: null, totalCount: 0 }),
    professionals: vi.fn().mockResolvedValue({
      items: [
        {
          accountId: 'recipient-account',
          grantId: 'recipient-grant',
          careAssignmentId: 'care',
          name: 'Destinatária Sintética',
          profession: 'ENFERMAGEM',
        },
      ],
    }),
    correctNote: vi.fn().mockResolvedValue(undefined),
    shareNote: vi.fn().mockResolvedValue(undefined),
    revokeShare: vi.fn().mockResolvedValue(undefined),
  };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: HealthApiService, useValue: api }],
  });
  const fixture = TestBed.createComponent(HealthNoteDetailComponent);
  fixture.componentRef.setInput('noteId', record.id);
  fixture.componentRef.setInput('own', own);
  fixture.detectChanges();
  await fixture.whenStable();
  await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, api };
}

describe('HealthNoteDetailComponent', () => {
  it('limita as categorias de autoria pela profissão habilitada', () => {
    expect(categoriesFor('PSICOLOGIA')).toEqual(['PSYCHOLOGICAL', 'SHARED_SUMMARY']);
    expect(categoriesFor('MEDICINA')).toEqual(['GENERAL', 'SHARED_SUMMARY']);
    expect(categoriesFor('ENFERMAGEM')).toEqual(['GENERAL', 'SHARED_SUMMARY']);
  });

  it('não corrige nem partilha quando o servidor nega capacidade, mesmo com texto preenchido', async () => {
    const { component, fixture, api } = await setup({
      ...note,
      canCorrect: false,
      canShare: false,
    });
    component.correction.setValue({ body: 'Texto diferente', reason: 'Justificativa válida' });
    await component.correct();
    await component.share();
    expect(api.correctNote).not.toHaveBeenCalled();
    expect(api.shareNote).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('Corrigir registro');
    expect(api.professionals).not.toHaveBeenCalled();
  });

  it('valida correção após trim e envia a versão conhecida com justificativa', async () => {
    const { component, api } = await setup();
    component.correction.setValue({ body: '  ', reason: '  curto  ' });
    await component.correct();
    expect(api.correctNote).not.toHaveBeenCalled();
    expect(component.correction.controls.body.touched).toBe(true);
    component.correction.setValue({
      body: '  Texto corrigido  ',
      reason: '  Justificativa válida  ',
    });
    await component.correct();
    expect(api.correctNote).toHaveBeenCalledWith(note.id, {
      version: 0,
      body: 'Texto corrigido',
      reason: 'Justificativa válida',
    });
  });

  it('exige seleção explícita de destinatário para partilhar', async () => {
    const { component, api } = await setup();
    await component.share();
    expect(api.shareNote).not.toHaveBeenCalled();
    expect(component.selectionError()).toBe(true);
    component.toggleRecipient('recipient-grant');
    await component.share();
    expect(api.shareNote).toHaveBeenCalledWith(note.id, 0, ['recipient-grant']);
  });

  it('permite nova seleção explícita após renovar o vínculo sem reutilizar a partilha antiga', async () => {
    const oldShare = {
      id: 'previous-share',
      recipientGrantId: 'recipient-grant',
      recipientCareAssignmentId: 'previous-care',
      recipientName: 'Destinatária Sintética',
      profession: 'ENFERMAGEM' as const,
      createdAt: note.createdAt,
      endedAt: null,
      version: 0,
    };
    const { component, api, fixture } = await setup({ ...note, shares: [oldShare] });
    expect(component.recipients().map((person) => person.careAssignmentId)).toEqual(['care']);
    expect(fixture.nativeElement.textContent).toContain('Acesso indisponível nesta consulta');
    await component.share();
    expect(api.shareNote).not.toHaveBeenCalled();
    api.note.mockResolvedValue({
      ...note,
      shares: [{ ...oldShare, recipientCareAssignmentId: 'care' }],
    });
    await component.load();
    expect(component.recipients()).toEqual([]);
  });

  it('mantém texto como conteúdo simples e paciente próprio não recebe ações profissionais', async () => {
    const { fixture, component, api } = await setup(
      { ...note, body: '<img src=x onerror=alert(1)>' },
      true,
    );
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(fixture.nativeElement.textContent).not.toContain('Corrigir registro');
    await component.correct();
    await component.share();
    expect(api.correctNote).not.toHaveBeenCalled();
    expect(api.shareNote).not.toHaveBeenCalled();
    expect(api.history).toHaveBeenCalledWith(note.id, true);
  });

  it('limpa conteúdo e histórico após revogação detectada em uma ação', async () => {
    const { component, api } = await setup();
    api.shareNote.mockRejectedValueOnce(new ApiError(403, 'forbidden'));
    component.toggleRecipient('recipient-grant');
    await component.share();
    expect(component.note()).toBeNull();
    expect(component.revisions()).toEqual([]);
    expect(component.correction.controls.body.value).toBe('');
    expect(component.error()).toContain('acesso não está disponível');
  });

  it('não anexa uma resposta atrasada do histórico depois de trocar o registro', async () => {
    const { component, fixture, api } = await setup();
    let finish!: (value: { items: unknown[]; nextCursor: null; totalCount: number }) => void;
    api.history.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    component.historyCursor.set(1);
    const pending = component.moreHistory();
    const other = { ...note, id: '00000000-0000-4000-8000-000000000062', body: 'Outro registro' };
    api.note.mockResolvedValue(other);
    fixture.componentRef.setInput('noteId', other.id);
    fixture.detectChanges();
    await vi.waitFor(() => expect(component.note()?.id).toBe(other.id));
    finish({
      items: [{ id: 'old-revision', body: 'Histórico do registro anterior' }],
      nextCursor: null,
      totalCount: 1,
    });
    await pending;
    expect(component.note()?.body).toBe(other.body);
    expect(component.revisions()).toEqual([]);
  });

  it('exige carregar versão atual após conflito antes de repetir uma correção', async () => {
    const { component, api } = await setup();
    component.correction.setValue({ body: 'Correção válida', reason: 'Justificativa válida' });
    api.correctNote.mockRejectedValueOnce(new ApiError(409, 'stale_version'));
    await component.correct();
    expect(component.conflict()).toBe(true);
    await component.correct();
    expect(api.correctNote).toHaveBeenCalledTimes(1);
    await component.load();
    expect(component.conflict()).toBe(false);
  });
});
