import { Injectable, inject, signal } from '@angular/core';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';
export interface Course {
  id: string;
  name: string;
  active: boolean;
  version: number;
}
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
  async save(name: string, current?: Course, active = true): Promise<Course> {
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
      };
      this.demoCourses.update((items) =>
        current ? items.map((c) => (c.id === current.id ? saved : c)) : [...items, saved],
      );
      if (current && current.name !== checked) this.demo.renameCourse(current.name, checked);
      return saved;
    }
    return this.request<Course>(
      current ? `/api/v1/cursos/${encodeURIComponent(current.id)}` : '/api/v1/cursos',
      { name, active, ...(current ? { version: current.version } : {}) },
    );
  }
  private async request<T extends Course | Course[]>(url: string, body?: object): Promise<T> {
    let headers: Record<string, string> = { Accept: 'application/json' };
    if (body) {
      const csrfResponse = await fetch('/api/v1/auth/csrf', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!csrfResponse.ok) throw new Error('Não foi possível proteger a sessão.');
      const csrf = await csrfResponse.json();
      if (typeof csrf.headerName !== 'string' || typeof csrf.token !== 'string')
        throw new Error('Resposta de sessão inválida.');
      headers = { ...headers, 'Content-Type': 'application/json', [csrf.headerName]: csrf.token };
    }
    const response = await fetch(url, {
      method: body ? (url === '/api/v1/cursos' ? 'POST' : 'PUT') : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok)
      throw new Error(
        response.status === 409
          ? 'Curso duplicado ou alterado por outra sessão. Recarregue a lista.'
          : 'Não foi possível consultar ou salvar o curso. Confira a conexão e sua permissão.',
      );
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
      typeof c.version === 'number';
    if (!(Array.isArray(result) ? result.every(valid) : valid(result)))
      throw new Error('Resposta de cursos inválida.');
    return result as T;
  }
}
