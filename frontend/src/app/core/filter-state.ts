import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
@Injectable({ providedIn: 'root' })
export class FilterState {
  readonly values = new Map<string, unknown>();
  private user: string | null = null;
  setUser(user: string | null): void {
    if (this.user !== user) this.clear();
    this.user = user;
  }
  clear(): void {
    this.values.clear();
  }
}
export function rememberFilters(key: string, control: AbstractControl): void {
  const state = inject(FilterState);
  if (state.values.has(key)) control.patchValue(state.values.get(key));
  control.valueChanges
    .pipe(takeUntilDestroyed(inject(DestroyRef)))
    .subscribe((value) => state.values.set(key, structuredClone(value)));
}

export function rememberValue<T>(key: string, initial: T) {
  const state = inject(FilterState);
  const value = signal(state.values.has(key) ? (state.values.get(key) as T) : initial);
  effect(() => {
    state.values.set(key, value());
  });
  return value;
}
