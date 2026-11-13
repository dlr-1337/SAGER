import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { FilterState } from '../../core/filter-state';
import { AccommodationApiService } from './accommodation-api.service';
import { AccommodationDataService } from './accommodation-data.service';
import { AccommodationsComponent } from './accommodations.component';
import { CourseApiService } from './course-api.service';
import { GuardianApiService } from './guardian-api.service';
import { GuardiansPage } from './guardians.pages';
import { ManagementDemoService } from './management-demo.service';
import { ResidentApiService } from './resident-api.service';
import { ResidentsComponent } from './residents.component';
import { RoomApiService } from './room-api.service';
import { RoomsComponent } from './rooms.component';
import { SupervisorApiService } from './supervisor-api.service';
import { SupervisorsComponent } from './supervisors.component';

type List =
  | ResidentsComponent
  | GuardiansPage
  | SupervisorsComponent
  | AccommodationsComponent
  | RoomsComponent;
const configs = [
  { component: ResidentsComponent, key: 'residents', pageKey: 'resident-page' },
  { component: GuardiansPage, key: 'guardians', pageKey: 'guardians.pages.ts-page' },
  { component: SupervisorsComponent, key: 'supervisors', pageKey: 'supervisors.component.ts-page' },
  {
    component: AccommodationsComponent,
    key: 'accommodations',
    pageKey: 'accommodations.component.ts-page',
  },
  { component: RoomsComponent, key: 'rooms', pageKey: 'rooms.component.ts-page' },
] as const;

function rows(list: List) {
  if (list instanceof ResidentsComponent) return list.visible();
  if (list instanceof RoomsComponent) return list.groups().flatMap((group) => group.rooms);
  return list.paged();
}

for (const config of configs) {
  describe(`Página restaurada na demonstração de ${config.key}`, () => {
    async function setup(total: number, initialPage = 1, delayed = false) {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      TestBed.inject(DemoSessionService).activate('gestor');
      const demo = TestBed.inject(ManagementDemoService);
      const housing = TestBed.inject(AccommodationDataService);
      const memory = TestBed.inject(FilterState);
      const remote = [
        vi.spyOn(TestBed.inject(ResidentApiService), 'page'),
        vi.spyOn(TestBed.inject(GuardianApiService), 'page'),
        vi.spyOn(TestBed.inject(SupervisorApiService), 'page'),
        vi.spyOn(TestBed.inject(AccommodationApiService), 'page'),
        vi.spyOn(TestBed.inject(RoomApiService), 'map'),
      ];
      const parent = demo.residents()[0];
      const records = [];
      for (let index = 0; index <= total; index++) {
        const letters = String(index)
          .padStart(3, '0')
          .replace(/\d/g, (digit) => 'abcdefghij'[Number(digit)]);
        const name = index < total ? `Sintético ${letters}` : 'Fora da busca';
        const code = `20261PAG${String(index).padStart(7, '0')}`;
        if (config.key === 'residents') {
          records.push(
            demo.saveResident({
              name,
              enrollment: code,
              birthDate: '2009-01-15',
              course: 'Informática',
            }),
          );
        } else if (config.key === 'guardians') {
          records.push(
            demo.saveGuardian(parent.id, {
              name,
              relationship: 'Mãe',
              phone: '62912345678',
              active: true,
              authorized: false,
            }),
          );
        } else if (config.key === 'supervisors') {
          records.push(
            demo.saveSupervisor({ name, institutionalId: code, email: `${index}@example.invalid` }),
          );
        } else if (config.key === 'accommodations') {
          records.push(await housing.save({ name, code }));
        } else {
          records.push(
            demo.saveRoom({ number: name, block: 'A', floor: 'Térreo', situation: 'Disponível' }),
          );
        }
      }
      const filters =
        config.key === 'residents'
          ? {
              search: 'Sintético',
              courseId: 'course-1',
              accommodationId: '',
              roomId: '',
              allocated: '',
            }
          : config.key === 'rooms'
            ? {
                search: 'Sintético',
                block: 'A',
                floor: 'Térreo',
                situation: 'Disponível',
                accommodationId: '',
                unitId: '',
              }
            : 'Sintético';
      memory.values.set(config.key, filters);
      memory.values.set(config.pageKey, initialPage);
      if (config.key === 'guardians') {
        memory.values.set('guardian-active', 'true');
        memory.values.set('guardian-resident', parent.id);
      }
      let release = () => {};
      if (delayed) {
        if (config.key === 'residents') {
          const courses = TestBed.inject(CourseApiService);
          vi.spyOn(courses, 'list').mockReturnValue(
            new Promise((resolve) => {
              release = () => resolve(courses.demoCourses());
            }),
          );
        } else {
          const catalog = await housing.list();
          vi.spyOn(housing, 'list').mockReturnValue(
            new Promise((resolve) => {
              release = () => resolve(catalog);
            }),
          );
        }
      }
      const component: Type<List> = config.component;
      const fixture = TestBed.createComponent(component);
      return { fixture, component, demo, housing, memory, filters, remote, records, release };
    }

    it.each([
      { total: 0, initialPage: 1, expectedPage: 0 },
      { total: 25, initialPage: 1, expectedPage: 0 },
      { total: 26, initialPage: 1, expectedPage: 1 },
      { total: 55, initialPage: 4, expectedPage: 2 },
    ])(
      'limita a página $initialPage aos $total resultados filtrados',
      async ({ total, initialPage, expectedPage }) => {
        const { fixture, memory, filters, remote, records } = await setup(total, initialPage);
        await fixture.whenStable();
        expect(fixture.componentInstance.page()).toBe(expectedPage);
        expect(rows(fixture.componentInstance).map((item) => item.id)).toEqual(
          records
            .slice(expectedPage * 25, Math.min(total, (expectedPage + 1) * 25))
            .map((item) => item.id),
        );
        expect(memory.values.get(config.pageKey)).toBe(expectedPage);
        expect(memory.values.get(config.key)).toEqual(filters);
        for (const request of remote) expect(request).not.toHaveBeenCalled();
        if (total === 25)
          expect(fixture.nativeElement.querySelector('sager-pagination nav')).toBeNull();
      },
    );

    it('corrige a página ao voltar depois de editar o único resultado da segunda página', async () => {
      const { fixture, component, demo, housing, records, memory, filters } = await setup(26);
      await fixture.whenStable();
      expect(rows(fixture.componentInstance).map((item) => item.id)).toEqual([records[25].id]);
      fixture.destroy();
      const id = records[25].id;
      if (config.key === 'residents') {
        demo.saveResident({ ...demo.resident(id)!, name: 'Fora da busca' }, id);
      } else if (config.key === 'guardians') {
        const guardian = demo.guardian(id)!;
        demo.saveGuardian(guardian.residentId, { ...guardian, name: 'Fora da busca' }, id);
      } else if (config.key === 'supervisors') {
        demo.saveSupervisor({ ...demo.supervisor(id)!, name: 'Fora da busca' }, id);
      } else if (config.key === 'accommodations') {
        const accommodation = await housing.get(id);
        await housing.save({ ...accommodation, name: 'Fora da busca' }, accommodation);
      } else {
        demo.saveRoom({ ...demo.room(id)!, number: 'Retirado da busca' }, id);
      }
      const restored = TestBed.createComponent(component);
      await restored.whenStable();
      expect(restored.componentInstance.page()).toBe(0);
      expect(rows(restored.componentInstance)).toHaveLength(25);
      expect(restored.nativeElement.querySelector('sager-pagination nav')).toBeNull();
      expect(memory.values.get(config.pageKey)).toBe(0);
      expect(memory.values.get(config.key)).toEqual(filters);
    });

    if (config.key === 'residents' || config.key === 'accommodations') {
      it('preserva a página válida enquanto os dados necessários ainda estão carregando', async () => {
        const { fixture, release, memory } = await setup(26, 1, true);
        await fixture.whenStable();
        expect(fixture.componentInstance.page()).toBe(1);
        expect(memory.values.get(config.pageKey)).toBe(1);
        release();
        await fixture.whenStable();
        expect(fixture.componentInstance.page()).toBe(1);
        expect(rows(fixture.componentInstance)).toHaveLength(1);
      });
    }
  });
}
