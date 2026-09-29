import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';
import { ResidentFormComponent } from './resident-form.component';

describe('ResidentFormComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResidentFormComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    TestBed.inject(DemoSessionService).activate('gestor');
  });

  it('keeps the resident list unchanged when required enrollment is missing', () => {
    const service = TestBed.inject(ManagementDemoService);
    const before = service.residents().length;
    const fixture = TestBed.createComponent(ResidentFormComponent);
    fixture.detectChanges();
    const form = fixture.componentInstance.form;
    form.setValue({
      name: 'Pessoa Demonstrativa',
      enrollment: '',
      birthDate: '2009-05-14',
      course: 'Agropecuária',
    });

    fixture.nativeElement.querySelector('button[type="submit"]').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Informe a matrícula vinculada ao residente',
    );
    expect(service.residents().length).toBe(before);
  });
});
