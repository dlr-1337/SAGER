import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';
import { RoomSituation } from './management.models';

@Component({
  selector: 'app-room-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page mg-narrow">
      @if (!canEdit()) { <section class="mg-empty" role="alert"><h1>Acesso restrito</h1><p>A edição de quartos está disponível apenas ao gestor.</p><a class="btn mg-primary" routerLink="/quartos">Voltar ao mapa</a></section> }
      @else if (editId && !room()) { <section class="mg-empty" role="alert"><h1>Quarto não encontrado</h1><p>O registro solicitado não está disponível nesta demonstração.</p><a class="btn mg-primary" routerLink="/quartos">Voltar ao mapa</a></section> }
      @else {
        <header class="mg-heading"><div><a class="mg-back" routerLink="/quartos"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Mapa de quartos</a><h1>{{ editId ? 'Editar quarto' : 'Cadastrar quarto' }}</h1><p>Identifique a localização e informe a situação atual.</p></div></header>
        <form class="panel mg-panel mg-form" [formGroup]="form" (ngSubmit)="save()" novalidate><h2>Dados do quarto</h2><p class="mg-muted">Campos marcados com * são obrigatórios.</p>
          <div class="form-grid mg-form-grid">
            <label class="field mg-field">Número do quarto *<input formControlName="number" autocomplete="off" />@if (form.controls.number.invalid && form.controls.number.touched) { <span class="mg-field-error">Informe o número do quarto.</span> }</label>
            <label class="field mg-field">Bloco *<select formControlName="block"><option value="">Selecione o bloco</option><option value="A">Bloco A</option><option value="B">Bloco B</option></select>@if (form.controls.block.invalid && form.controls.block.touched) { <span class="mg-field-error">Selecione o bloco.</span> }</label>
            <label class="field mg-field">Piso *<select formControlName="floor"><option value="">Selecione o piso</option><option value="Térreo">Térreo</option><option value="1º piso">1º piso</option></select>@if (form.controls.floor.invalid && form.controls.floor.touched) { <span class="mg-field-error">Selecione o piso.</span> }</label>
            <label class="field mg-field">Situação *<select formControlName="situation"><option value="">Selecione a situação</option>@for (item of situations; track item) { <option [value]="item">{{ item }}</option> }</select>@if (form.controls.situation.invalid && form.controls.situation.touched) { <span class="mg-field-error">Selecione a situação atual.</span> }</label>
          </div>
          <div class="mg-note"><span class="material-symbols-rounded" aria-hidden="true">info</span><p>O número precisa ser único em toda a demonstração. A ocupação e a nota de limpeza são mostradas no mapa e não são alteradas neste formulário. Novos blocos e pisos dependem de configuração institucional.</p></div>
          @if (error()) { <p class="mg-alert" role="alert">{{ error() }}</p> }
          <div class="action-row mg-actions"><a class="btn mg-secondary" [routerLink]="editId ? ['/quartos', editId] : ['/quartos']">Cancelar</a><button type="submit" class="btn mg-primary"><span class="material-symbols-rounded" aria-hidden="true">save</span> Salvar quarto</button></div>
        </form>
      }
    </main>
  `,
})
export class RoomFormComponent {
  private readonly service = inject(ManagementDemoService);
  private readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly editId = this.route.snapshot.paramMap.get('id');
  readonly canEdit = computed(() => this.session.hasRole('gestor'));
  readonly room = computed(() => this.editId ? this.service.room(this.editId) : undefined);
  readonly error = signal('');
  readonly situations: RoomSituation[] = ['Disponível', 'Ocupado', 'Manutenção', 'Indisponível'];
  readonly form = new FormGroup({
    number: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    block: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    floor: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    situation: new FormControl<RoomSituation | ''>('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    const existing = this.room();
    if (existing) this.form.setValue({ number: existing.number, block: existing.block, floor: existing.floor, situation: existing.situation });
  }

  save(): void {
    if (!this.canEdit()) return;
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    try {
      const { number, block, floor, situation } = this.form.getRawValue();
      const room = this.service.saveRoom({ number, block, floor, situation: situation as RoomSituation }, this.editId ?? undefined);
      void this.router.navigate(['/quartos', room.id], { queryParams: { saved: '1' } });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Não foi possível salvar o quarto. Tente novamente.');
    }
  }
}
