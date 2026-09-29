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
    fixture.componentInstance.form.setValue({ code: 'TESTE-A', name: 'Alojamento Sintético' });

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
});
