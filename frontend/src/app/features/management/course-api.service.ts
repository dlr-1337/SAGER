import { ERROR_GENERIC } from '../../core/error-messages';
import { Injectable, inject, signal } from '@angular/core';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';
import { api } from '../../core/api';
export const COURSE_LEVELS = { MEDIO: 'Ensino médio', SUPERIOR: 'Superior' } as const;
export type CourseLevel = keyof typeof COURSE_LEVELS;
export interface Course {
  id: string;
  name: string;
  active: boolean;
  version: number;
  level?: CourseLevel | null;
  durationYears?: number | null;
}
export type CourseInput = Pick<Course, 'name' | 'level' | 'durationYears'>;
@Injectable({ providedIn: 'root' })
export class CourseApiService {
  private readonly session = inject(DemoSessionService);
  private readonly demo = inject(ManagementDemoService);
  readonly demoCourses = signal<Course[]>(
    ['Agropecuária', 'Informática', 'Alimentos'].map((name, i) => ({
      id: `course-${i}`,
      name,
      active: true,
      version: 0,
    })),
  );
  async list(): Promise<Course[]> {
    return this.session.active() ? this.demoCourses() : this.request<Course[]>('/api/v1/cursos');
  }
  async save(input: CourseInput, current?: Course, active = true): Promise<Course> {
    const { name, level = null, durationYears = null } = input;
    if (this.session.active()) {
      const checked = name.trim().replace(/\s+/g, ' ');
      if (!checked || checked.length > 200)
        throw new Error('Informe um nome de até 200 caracteres.');
      if (
        this.demoCourses().some(
          (c) => c.id !== current?.id && c.name.toLocaleLowerCase() === checked.toLocaleLowerCase(),
        )
      )
        throw new Error('Já existe um curso com esse nome.');
      const saved = {
        id: current?.id ?? crypto.randomUUID(),
        name: checked,
        active,
        version: (current?.version ?? -1) + 1,
        level,
        durationYears,
      };
      this.demoCourses.update((items) =>
        current ? items.map((c) => (c.id === current.id ? saved : c)) : [...items, saved],
      );
      if (current && current.name !== checked) this.demo.renameCourse(current.name, checked);
      return saved;
    }
    return this.request<Course>(
      current ? `/api/v1/cursos/${encodeURIComponent(current.id)}` : '/api/v1/cursos',
      { name, active, level, durationYears, ...(current ? { version: current.version } : {}) },
    );
  }
  private async request<T extends Course | Course[]>(url: string, body?: object): Promise<T> {
    const response = await api(url, {
      method: body ? (url === '/api/v1/cursos' ? 'POST' : 'PUT') : 'GET',
      body,
      error: (response) =>
        new Error(
          response.status === 409
            ? 'Já existe um curso com esse nome, ou outra pessoa alterou este curso. Recarregue a lista e confira.'
            : ERROR_GENERIC,
        ),
    });
    const result: unknown = await response.json();
    const valid = (c: unknown): c is Course =>
      !!c &&
      typeof c === 'object' &&
      'id' in c &&
      typeof c.id === 'string' &&
      'name' in c &&
      typeof c.name === 'string' &&
      'active' in c &&
      typeof c.active === 'boolean' &&
      'version' in c &&
      typeof c.version === 'number' &&
      (!('level' in c) ||
        c.level === null ||
        (typeof c.level === 'string' && c.level in COURSE_LEVELS)) &&
      (!('durationYears' in c) || c.durationYears === null || Number.isInteger(c.durationYears));
    if (!(Array.isArray(result) ? result.every(valid) : valid(result)))
      throw new Error(ERROR_GENERIC);
    return result as T;
  }
}
