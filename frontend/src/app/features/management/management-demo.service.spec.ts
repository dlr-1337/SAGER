import { vi } from 'vitest';
import { OperationsDemoService } from '../operations/operations-demo.service';
import { ManagementDemoService } from './management-demo.service';

describe('ManagementDemoService', () => {
  it('lists in the demo night call only residents under 18 on 2026-12-31', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T12:00:00-03:00'));
    try {
      const residents = new ManagementDemoService().residents();
      const today = new Date().toISOString().slice(0, 10);
      for (const minor of new OperationsDemoService().minors) {
        const birth = residents.find((item) => item.name === minor.name)?.birthDate ?? '';
        const age =
          Number(today.slice(0, 4)) -
          Number(birth.slice(0, 4)) -
          (today.slice(5) < birth.slice(5) ? 1 : 0);
        expect(age, minor.name).toBeLessThan(18);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a duplicate room number across blocks without changing the map', () => {
    const service = new ManagementDemoService();
    const before = service.rooms().length;

    expect(() =>
      service.saveRoom({ number: '101', block: 'B', floor: '1º piso', situation: 'Disponível' }),
    ).toThrowError('Este número de quarto já está cadastrado. Use outro número.');
    expect(service.rooms().length).toBe(before);
  });

  it.each([
    ['joao silva', 'Joao Silva'],
    ['JOÃO silva', 'João Silva'],
    ["ANA-MARIA D'ÁVILA  ÇÃO", "Ana-Maria D'Ávila Ção"],
  ])('formats the resident name %s', (typed, expected) => {
    const resident = new ManagementDemoService().saveResident({
      name: typed,
      enrollment: '20261DEMONOME001',
      birthDate: '2009-04-12',
      course: 'Informática',
    });

    expect(resident.name).toBe(expected);
  });

  it('links a resident and guardian only for the current in-memory demonstration', () => {
    const service = new ManagementDemoService();
    const resident = service.saveResident({
      name: 'Pessoa de Teste',
      enrollment: '20261DEMOTEST009',
      birthDate: '2009-04-12',
      course: 'Informática',
    });
    service.saveGuardian(resident.id, {
      name: 'Responsável de Teste',
      relationship: 'Mãe',
      phone: '62999990009',
      active: true,
      authorized: true,
    });

    expect(service.resident(resident.id)?.enrollment).toBe('20261DEMOTEST009');
    expect(service.guardiansFor(resident.id)).toEqual([
      expect.objectContaining({ phone: '62999990009', authorized: true }),
    ]);
    expect(new ManagementDemoService().resident(resident.id)).toBeUndefined();
  });

  it('refuses new values outside the registration rules', () => {
    const service = new ManagementDemoService();
    const valid = {
      name: 'Pessoa de Teste',
      enrollment: '20261DEMOTEST010',
      birthDate: '2009-04-12',
      course: 'Informática',
    };
    expect(() => service.saveResident({ ...valid, name: 'Maria' })).toThrowError(
      'Digite o nome completo, como no documento.',
    );
    expect(() => service.saveResident({ ...valid, enrollment: 'DEMO-A' })).toThrowError(
      'Confira a matrícula no SUAP.',
    );
    expect(() => service.saveResident({ ...valid, birthDate: '1900-01-01' })).toThrowError(
      'Confira a data de nascimento.',
    );
    expect(() =>
      service.saveResident({ ...valid, institutionalEmail: 'a@gmail.com' }),
    ).toThrowError('Use o e-mail institucional, que termina em @estudante.ifgoiano.edu.br.');
    expect(() => service.saveResident({ ...valid, course: ' ' })).toThrowError('Escolha o curso.');
    const parent = service.residents()[0].id;
    const guardian = {
      name: 'Responsável de Teste',
      relationship: 'Mãe',
      phone: '(62) 91234-5678',
      active: true,
      authorized: true,
    };
    expect(() => service.saveGuardian(parent, { ...guardian, phone: '91234-5678' })).toThrowError(
      'Digite o telefone com DDD.',
    );
    expect(() => service.saveGuardian(parent, { ...guardian, relationship: '12' })).toThrowError(
      'Escreva o vínculo, como mãe ou pai.',
    );
    expect(service.saveGuardian(parent, guardian).phone).toBe('62912345678');
    expect(() =>
      service.saveSupervisor({ name: 'Ana Exemplo', institutionalId: 'a@b', email: 'a@b.c' }),
    ).toThrowError('Use de 4 a 20 letras, números ou hífen.');
  });

  it('lets an old record change other fields while the old value stays as it was', () => {
    const service = new ManagementDemoService();
    const old = {
      ...service.residents()[0],
      name: 'Maria',
      enrollment: 'DEMO-A',
      birthDate: '1900-01-01',
    };
    service['state'].update((state) => ({ ...state, residents: [old] }));
    const saved = service.saveResident(
      { name: 'Maria', enrollment: 'DEMO-A', birthDate: '1900-01-01', course: 'Alimentos' },
      old.id,
    );
    expect(saved).toEqual(
      expect.objectContaining({ name: 'Maria', enrollment: 'DEMO-A', course: 'Alimentos' }),
    );
    expect(() =>
      service.saveResident(
        { name: 'Mariana', enrollment: 'DEMO-A', birthDate: '1900-01-01', course: 'Alimentos' },
        old.id,
      ),
    ).toThrowError('Digite o nome completo');
    expect(() =>
      service.saveResident(
        { name: 'Maria', enrollment: 'DEMO-B', birthDate: '1900-01-01', course: 'Alimentos' },
        old.id,
      ),
    ).toThrowError('Confira a matrícula');
  });
});
