import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { FilterState, rememberFilters, rememberValue } from './filter-state';
@Component({ standalone: true, template: '' })
class FilterHost {
  readonly query = new FormControl('', { nonNullable: true });
  readonly page = rememberValue('page-test', 0);
  constructor() {
    rememberFilters('query-test', this.query);
  }
}
describe('Critérios da sessão', () => {
  it('preserva busca e página ao voltar e apaga ao trocar de usuário', () => {
    const state = TestBed.inject(FilterState);
    state.setUser('account-a');
    const first = TestBed.createComponent(FilterHost);
    first.componentInstance.query.setValue('João');
    first.componentInstance.page.set(2);
    first.detectChanges();
    first.destroy();
    const restored = TestBed.createComponent(FilterHost);
    expect(restored.componentInstance.query.value).toBe('João');
    expect(restored.componentInstance.page()).toBe(2);
    restored.detectChanges();
    restored.destroy();
    state.setUser('account-b');
    const other = TestBed.createComponent(FilterHost);
    expect(other.componentInstance.query.value).toBe('');
    expect(other.componentInstance.page()).toBe(0);
    other.destroy();
    state.clear();
    expect(state.values.size).toBe(0);
  });
});
