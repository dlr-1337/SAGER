import { ManagementDemoService } from './management-demo.service';

describe('ManagementDemoService', () => {
  it('rejects a duplicate room number across blocks without changing the map', () => {
    const service = new ManagementDemoService();
    const before = service.rooms().length;

    expect(() => service.saveRoom({ number: '101', block: 'B', floor: '1º piso', situation: 'Disponível' })).toThrowError('Este número de quarto já está cadastrado. Use outro número.');
    expect(service.rooms().length).toBe(before);
  });

  it('links a resident and guardian only for the current in-memory demonstration', () => {
    const service = new ManagementDemoService();
    const resident = service.saveResident({ name: 'Pessoa de Teste', enrollment: 'DEMO-TEST-009', birthDate: '2009-04-12', course: 'Informática' });
    service.saveGuardian(resident.id, { name: 'Responsável de Teste', relationship: 'Mãe', phone: '62999990009', active: true, authorized: true });

    expect(service.resident(resident.id)?.enrollment).toBe('DEMO-TEST-009');
    expect(service.guardiansFor(resident.id)).toEqual([expect.objectContaining({ phone: '62999990009', authorized: true })]);
    expect(new ManagementDemoService().resident(resident.id)).toBeUndefined();
  });
});
