import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { AccommodationDataService } from './accommodation-data.service';
import { AccommodationFormComponent } from './accommodation-form.component';
import { Accommodation } from './housing.models';

describe('AccommodationFormComponent', () => {
  it('não redireciona após cancelar enquanto o salvamento ainda responde', async () => {
    let finishSave!: (value: Accommodation) => void;
    const pendingSave = new Promise<Accommodation>((resolve) => {
      finishSave = resolve;
    });
    const save = vi.fn().mockReturnValue(pendingSave);
    TestBed.configureTestingModule({
      imports: [AccommodationFormComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({}) } },
        },
        { provide: DemoSessionService, useValue: { hasRole: () => true } },
        { provide: AccommodationDataService, useValue: { save } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AccommodationFormComponent);
    fixture.componentInstance.form.setValue({
      code: 'TESTE-A',
      name: 'Alojamento Sintético',
      ageGroup: '',
    });

    const result = fixture.componentInstance.save();
    expect(save).toHaveBeenCalledOnce();
    fixture.destroy();
    finishSave({
      id: '00000000-0000-0000-0000-000000000031',
      code: 'TESTE-A',
      name: 'Alojamento Sintético',
      version: 0,
    });
    await result;

    expect(navigate).not.toHaveBeenCalled();
  });

  it('carrega a faixa etária salva e envia null ao trocar para sem faixa', async () => {
    const saved: Accommodation = {
      id: '00000000-0000-0000-0000-000000000032',
      code: 'TESTE-M',
      name: 'Alojamento Sintético',
      ageGroup: 'MAIORES',
      version: 3,
    };
    const save = vi.fn().mockResolvedValue({ ...saved, ageGroup: null, version: 4 });
    TestBed.configureTestingModule({
      imports: [AccommodationFormComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: saved.id }) } },
        },
        { provide: DemoSessionService, useValue: { hasRole: () => true } },
        {
          provide: AccommodationDataService,
          useValue: { get: vi.fn().mockResolvedValue(saved), save },
        },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AccommodationFormComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    expect(select.value).toBe('MAIORES');
    expect(select.selectedOptions[0].textContent).toContain('Maiores de 18 anos');
    select.value = '';
    select.dispatchEvent(new Event('change'));
    await fixture.componentInstance.save();
    expect(save).toHaveBeenCalledWith(
      { code: 'TESTE-M', name: 'Alojamento Sintético', ageGroup: null },
      saved,
    );
  });
});
