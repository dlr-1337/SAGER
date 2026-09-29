import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { HousingMap, RoomRecord, RoomRecordInput } from './housing.models';
import { ManagementDemoService } from './management-demo.service';
import { RoomSituation } from './management.models';
import { RoomApiError, RoomApiService, roomLoadError } from './room-api.service';

const positiveInteger: ValidatorFn = (control) =>
  control.value === null ||
  (typeof control.value === 'number' &&
    Number.isInteger(control.value) &&
    control.value > 0 &&
    control.value <= 2147483647)
    ? null
    : { positiveInteger: true };

@Component({
  selector: 'app-room-form',
  styleUrl: './housing.scss',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page mg-narrow">
      @if (!canEdit()) {
        <section class="mg-empty" role="alert">
          <h1>Acesso restrito</h1>
          <p>A edição de quartos está disponível apenas ao gestor.</p>
          <a class="btn mg-primary" routerLink="/quartos">Voltar ao mapa</a>
        </section>
      } @else if (loading()) {
        <section class="mg-empty" role="status" aria-live="polite">
          <span class="material-symbols-rounded mg-loading-icon" aria-hidden="true"
            >progress_activity</span
          >
          <h1>Carregando dados do quarto</h1>
          <p>Consultando a localização cadastrada no ambiente local de teste.</p>
        </section>
      } @else if (loadError()) {
        <section class="mg-empty" role="alert">
          <h1>
            {{ missing() ? 'Quarto não encontrado' : 'Não foi possível carregar o formulário' }}
          </h1>
          <p>{{ loadError() }}</p>
          @if (sessionRequired()) {
            <a class="btn mg-primary" routerLink="/acesso">Entrar novamente</a>
          } @else if (!missing()) {
            <button type="button" class="btn mg-primary" (click)="load()">Tentar novamente</button>
          }
          <a class="btn mg-secondary" routerLink="/quartos">Voltar ao mapa</a>
        </section>
      } @else if (isDemo() && editId && !room()) {
        <section class="mg-empty" role="alert">
          <h1>Quarto não encontrado</h1>
          <p>O registro solicitado não está disponível nesta demonstração.</p>
          <a class="btn mg-primary" routerLink="/quartos">Voltar ao mapa</a>
        </section>
      } @else if (!isDemo() && !localMap().accommodations.length) {
        <section class="mg-empty" role="status">
          <h1>Cadastre um alojamento primeiro</h1>
          <p>O quarto precisa pertencer a um alojamento. Casas e blocos internos são opcionais.</p>
          <a class="btn mg-primary" routerLink="/alojamentos">Gerenciar alojamentos</a
          ><a class="btn mg-secondary" routerLink="/quartos">Voltar ao mapa</a>
        </section>
      } @else {
        <header class="mg-heading">
          <div>
            <a class="mg-back" routerLink="/quartos"
              ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Mapa de
              quartos</a
            >
            <h1>{{ editId ? 'Editar quarto' : 'Cadastrar quarto' }}</h1>
            <p>Identifique a localização e informe a situação atual.</p>
          </div>
        </header>
        @if (isDemo()) {
          <form class="panel mg-panel mg-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
            <h2>Dados do quarto</h2>
            <p class="mg-muted">
              Campos marcados com * são obrigatórios. Estes registros são demonstrativos.
            </p>
            <div class="form-grid mg-form-grid">
              <label class="field mg-field"
                >Número do quarto *<input formControlName="number" autocomplete="off" />
                @if (form.controls.number.invalid && form.controls.number.touched) {
                  <span class="mg-field-error">Informe o número do quarto.</span>
                }
              </label>
              <label class="field mg-field"
                >Bloco *<select formControlName="block">
                  <option value="">Selecione o bloco</option>
                  <option value="A">Bloco A</option>
                  <option value="B">Bloco B</option>
                </select>
                @if (form.controls.block.invalid && form.controls.block.touched) {
                  <span class="mg-field-error">Selecione o bloco.</span>
                }
              </label>
              <label class="field mg-field"
                >Piso *<select formControlName="floor">
                  <option value="">Selecione o piso</option>
                  <option value="Térreo">Térreo</option>
                  <option value="1º piso">1º piso</option>
                </select>
                @if (form.controls.floor.invalid && form.controls.floor.touched) {
                  <span class="mg-field-error">Selecione o piso.</span>
                }
              </label>
              <label class="field mg-field"
                >Situação *<select formControlName="situation">
                  <option value="">Selecione a situação</option>
                  @for (item of situations; track item) {
                    <option [value]="item">{{ item }}</option>
                  }
                </select>
                @if (form.controls.situation.invalid && form.controls.situation.touched) {
                  <span class="mg-field-error">Selecione a situação atual.</span>
                }
              </label>
            </div>
            <div class="mg-note">
              <span class="material-symbols-rounded" aria-hidden="true">info</span>
              <p>
                O número precisa ser único em toda a demonstração. A ocupação e a nota de limpeza
                são mostradas no mapa e não são alteradas neste formulário.
              </p>
            </div>
            @if (error()) {
              <p class="mg-alert" role="alert">{{ error() }}</p>
            }
            <div class="action-row mg-actions">
              <a
                class="btn mg-secondary"
                [routerLink]="editId ? ['/quartos', editId] : ['/quartos']"
                >Cancelar</a
              ><button type="submit" class="btn mg-primary">
                <span class="material-symbols-rounded" aria-hidden="true">save</span> Salvar quarto
              </button>
            </div>
          </form>
        } @else {
          <form
            class="panel mg-panel mg-form"
            [formGroup]="localForm"
            (ngSubmit)="save()"
            novalidate
          >
            <h2>Dados do quarto</h2>
            <p class="mg-muted">
              Campos marcados com * são obrigatórios. Use somente dados fictícios no ambiente local
              de teste.
            </p>
            <div class="form-grid mg-form-grid">
              <label class="field mg-field" [class.mg-invalid]="invalid('code')"
                >Código global *<input
                  formControlName="code"
                  autocomplete="off"
                  maxlength="64"
                  [attr.aria-invalid]="invalid('code') ? 'true' : null"
                  [attr.aria-describedby]="invalid('code') ? 'room-code-error' : 'room-code-hint'"
                /><span class="mg-muted" id="room-code-hint"
                  >Identificador único entre todos os alojamentos.</span
                >
                @if (invalid('code')) {
                  <span class="mg-field-error" id="room-code-error"
                    >Informe um código com até 64 caracteres.</span
                  >
                }
              </label>
              <label class="field mg-field" [class.mg-invalid]="invalid('number')"
                >Número do quarto *<input
                  formControlName="number"
                  autocomplete="off"
                  maxlength="64"
                  [attr.aria-invalid]="invalid('number') ? 'true' : null"
                  [attr.aria-describedby]="
                    invalid('number') ? 'room-number-error' : 'room-number-hint'
                  "
                /><span class="mg-muted" id="room-number-hint"
                  >Pode se repetir em outra localização. Zeros iniciais são preservados.</span
                >
                @if (invalid('number')) {
                  <span class="mg-field-error" id="room-number-error"
                    >Informe um número ou identificação com até 64 caracteres.</span
                  >
                }
              </label>
              <label class="field mg-field" [class.mg-invalid]="invalid('accommodationId')"
                >Alojamento *<select
                  formControlName="accommodationId"
                  [attr.aria-invalid]="invalid('accommodationId') ? 'true' : null"
                  [attr.aria-describedby]="
                    invalid('accommodationId') ? 'room-accommodation-error' : null
                  "
                >
                  <option value="">Selecione o alojamento</option>
                  @for (item of localMap().accommodations; track item.id) {
                    <option [value]="item.id">{{ item.name }}</option>
                  }
                </select>
                @if (invalid('accommodationId')) {
                  <span class="mg-field-error" id="room-accommodation-error"
                    >Selecione o alojamento.</span
                  >
                }
              </label>
              <label class="field mg-field"
                >Casa ou bloco (opcional)<select formControlName="unitId">
                  <option value="">Sem casa ou bloco</option>
                  @for (item of units(); track item.id) {
                    <option [value]="item.id">{{ item.name }}</option>
                  }
                </select></label
              >
              <label class="field mg-field" [class.mg-invalid]="invalid('floor')"
                >Piso (opcional)<input
                  formControlName="floor"
                  autocomplete="off"
                  maxlength="64"
                  [attr.aria-invalid]="invalid('floor') ? 'true' : null"
                  [attr.aria-describedby]="invalid('floor') ? 'room-floor-error' : null"
                />
                @if (invalid('floor')) {
                  <span class="mg-field-error" id="room-floor-error"
                    >Use até 64 caracteres para o piso.</span
                  >
                }
              </label>
              <label class="field mg-field" [class.mg-invalid]="invalid('capacity')"
                >Capacidade (opcional)<input
                  type="number"
                  formControlName="capacity"
                  min="1"
                  max="2147483647"
                  step="1"
                  [attr.aria-invalid]="invalid('capacity') ? 'true' : null"
                  [attr.aria-describedby]="
                    invalid('capacity') ? 'room-capacity-error' : 'room-capacity-hint'
                  "
                /><span class="mg-muted" id="room-capacity-hint"
                  >Deixe em branco quando a capacidade ainda não estiver definida.</span
                >
                @if (invalid('capacity')) {
                  <span class="mg-field-error" id="room-capacity-error"
                    >Informe um número inteiro positivo ou deixe em branco.</span
                  >
                }
              </label>
              <label class="field mg-field" [class.mg-invalid]="invalid('situation')"
                >Situação *<select
                  formControlName="situation"
                  [attr.aria-invalid]="invalid('situation') ? 'true' : null"
                  [attr.aria-describedby]="invalid('situation') ? 'room-situation-error' : null"
                >
                  <option value="">Selecione a situação</option>
                  @for (item of situations; track item) {
                    <option [value]="item">{{ item }}</option>
                  }
                </select>
                @if (invalid('situation')) {
                  <span class="mg-field-error" id="room-situation-error"
                    >Selecione a situação atual.</span
                  >
                }
              </label>
            </div>
            <div class="mg-note">
              <span class="material-symbols-rounded" aria-hidden="true">info</span>
              <p>
                A situação é manual. Alterar a capacidade não informa ocupação nem vagas livres; a
                alocação de moradores ainda não está integrada.
              </p>
            </div>
            @if (error()) {
              <p class="mg-alert" role="alert">{{ error() }}</p>
            }
            @if (conflict()) {
              <button
                type="button"
                class="btn mg-secondary"
                [disabled]="saving()"
                (click)="reloadLatest()"
              >
                Carregar versão atual do quarto
              </button>
              <p class="mg-muted">Esta ação substituirá os campos pela versão salva no servidor.</p>
            }
            @if (saveSessionRequired()) {
              <a class="btn mg-secondary" routerLink="/acesso">Entrar novamente</a>
            }
            <div class="action-row mg-actions">
              <a
                class="btn mg-secondary"
                [routerLink]="editId ? ['/quartos', editId] : ['/quartos']"
                >Cancelar</a
              ><button type="submit" class="btn mg-primary" [disabled]="saving()">
                <span class="material-symbols-rounded" aria-hidden="true">save</span>
                {{ saving() ? 'Salvando…' : 'Salvar quarto' }}
              </button>
            </div>
          </form>
        }
      }
    </main>
  `,
})
export class RoomFormComponent {
  private readonly demo = inject(ManagementDemoService);
  private readonly api = inject(RoomApiService);
  private readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly editId = this.route.snapshot.paramMap.get('id');
  readonly isDemo = this.session.active;
  readonly canEdit = computed(() => this.session.hasRole('gestor'));
  readonly room = computed(() =>
    this.isDemo() && this.editId ? this.demo.room(this.editId) : undefined,
  );
  readonly localRoom = signal<RoomRecord | null>(null);
  readonly localMap = signal<HousingMap>({ accommodations: [], units: [], rooms: [] });
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly missing = signal(false);
  readonly sessionRequired = signal(false);
  readonly saveSessionRequired = signal(false);
  readonly error = signal('');
  readonly conflict = signal(false);
  readonly saving = signal(false);
  readonly situations: RoomSituation[] = ['Disponível', 'Ocupado', 'Manutenção', 'Indisponível'];
  readonly form = new FormGroup({
    number: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    block: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    floor: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    situation: new FormControl<RoomSituation | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  readonly localForm = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(64)],
    }),
    number: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(64)],
    }),
    accommodationId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    unitId: new FormControl('', { nonNullable: true }),
    floor: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(64)] }),
    capacity: new FormControl<number | null>(null, { validators: [positiveInteger] }),
    situation: new FormControl<RoomSituation | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  private readonly accommodationId = toSignal(
    this.localForm.controls.accommodationId.valueChanges,
    { initialValue: '' },
  );
  readonly units = computed(() =>
    this.localMap().units.filter((item) => item.accommodationId === this.accommodationId()),
  );

  constructor() {
    this.localForm.controls.accommodationId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.localForm.controls.unitId.setValue(''));
    if (this.isDemo()) {
      const item = this.room();
      if (item)
        this.form.setValue({
          number: item.number,
          block: item.block,
          floor: item.floor,
          situation: item.situation,
        });
    } else if (this.canEdit()) void this.load();
  }

  invalid(field: keyof typeof this.localForm.controls): boolean {
    const control = this.localForm.controls[field];
    return control.invalid && control.touched;
  }

  async load(reload = false): Promise<void> {
    if (this.isDemo() || !this.canEdit()) return;
    if (reload) this.saving.set(true);
    else this.loading.set(true);
    this.loadError.set('');
    this.missing.set(false);
    this.sessionRequired.set(false);
    try {
      const [map, room] = await Promise.all([
        this.api.map(),
        this.editId ? this.api.get(this.editId) : Promise.resolve(null),
      ]);
      this.localMap.set(map);
      this.localRoom.set(room);
      if (room) this.setFields(room);
      this.error.set('');
      this.conflict.set(false);
      this.saveSessionRequired.set(false);
    } catch (error) {
      if (reload) {
        this.error.set(`${roomLoadError(error)} Suas alterações no formulário foram preservadas.`);
      } else {
        this.localRoom.set(null);
        this.missing.set(error instanceof RoomApiError && error.status === 404);
        this.sessionRequired.set(
          error instanceof RoomApiError && [401, 403].includes(error.status),
        );
        this.loadError.set(roomLoadError(error));
      }
    } finally {
      if (reload) this.saving.set(false);
      else this.loading.set(false);
    }
  }

  async reloadLatest(): Promise<void> {
    if (!this.saving()) await this.load(true);
  }

  async save(): Promise<void> {
    if (!this.canEdit() || this.saving()) return;
    this.error.set('');
    this.saveSessionRequired.set(false);
    if (this.isDemo()) {
      if (this.form.invalid) {
        this.form.markAllAsTouched();
        return;
      }
      try {
        const { number, block, floor, situation } = this.form.getRawValue();
        const room = this.demo.saveRoom(
          { number, block, floor, situation: situation as RoomSituation },
          this.editId ?? undefined,
        );
        await this.router.navigate(['/quartos', room.id], { queryParams: { saved: '1' } });
      } catch (error) {
        this.error.set(
          error instanceof Error
            ? error.message
            : 'Não foi possível salvar o quarto. Tente novamente.',
        );
      }
      return;
    }
    const fields = this.localForm.getRawValue();
    this.localForm.patchValue({
      code: fields.code.trim(),
      number: fields.number.trim(),
      floor: fields.floor.trim(),
    });
    if (this.localForm.invalid) {
      this.localForm.markAllAsTouched();
      return;
    }
    const unit = fields.unitId
      ? this.localMap().units.find((item) => item.id === fields.unitId)
      : null;
    if (
      !this.localMap().accommodations.some((item) => item.id === fields.accommodationId) ||
      (fields.unitId && unit?.accommodationId !== fields.accommodationId)
    ) {
      this.error.set(
        'A localização selecionada é inválida. Confira o alojamento e a casa ou bloco.',
      );
      return;
    }
    const existing = this.localRoom();
    if (this.editId && !existing) {
      this.error.set('Carregue o quarto antes de salvar a edição.');
      return;
    }
    const input: RoomRecordInput = {
      code: fields.code.trim(),
      number: fields.number.trim(),
      accommodationId: fields.accommodationId,
      unitId: fields.unitId || null,
      floor: fields.floor.trim() || null,
      capacity: fields.capacity,
      situation: fields.situation as RoomSituation,
    };
    this.saving.set(true);
    try {
      const saved = await this.api.save(
        input,
        this.editId && existing ? { id: existing.id, version: existing.version } : undefined,
      );
      await this.router.navigate(['/quartos', saved.id], { queryParams: { saved: '1' } });
    } catch (error) {
      const stale =
        error instanceof RoomApiError && error.status === 409 && error.code === 'stale_version';
      this.conflict.set(stale);
      if (stale)
        this.error.set(
          'Este quarto foi alterado por outra sessão. Suas alterações foram preservadas. Carregue a versão atual antes de salvar novamente.',
        );
      else if (
        error instanceof RoomApiError &&
        error.status === 409 &&
        error.code === 'duplicate_code'
      )
        this.error.set('Já existe um quarto com este código global. Informe outro código.');
      else if (
        error instanceof RoomApiError &&
        error.status === 409 &&
        error.code === 'duplicate_location'
      )
        this.error.set(
          'Já existe um quarto com este número na mesma localização. Confira o alojamento, a casa ou bloco e o piso.',
        );
      else if (error instanceof RoomApiError && error.code === 'invalid_location')
        this.error.set('A localização foi recusada. Confira o alojamento e a casa ou bloco.');
      else if (error instanceof RoomApiError && error.status === 400)
        this.error.set(
          'Os dados foram recusados. Confira os campos e a capacidade e tente novamente.',
        );
      else if (error instanceof RoomApiError && error.status === 404)
        this.error.set(
          'O quarto ou a localização não está mais disponível. Volte ao mapa para conferir os registros.',
        );
      else if (error instanceof RoomApiError && [401, 403].includes(error.status)) {
        this.saveSessionRequired.set(true);
        this.error.set(
          error.status === 401
            ? 'A sessão expirou. Entre novamente para salvar.'
            : 'A sessão não permite salvar este quarto. Entre novamente com perfil de gestor.',
        );
      } else
        this.error.set(
          'Não foi possível confirmar o salvamento. Confira a conexão com o backend local e tente novamente.',
        );
    } finally {
      this.saving.set(false);
    }
  }

  private setFields(item: RoomRecord): void {
    this.localForm.setValue({
      code: item.code,
      number: item.number,
      accommodationId: item.accommodationId,
      unitId: item.unitId ?? '',
      floor: item.floor ?? '',
      capacity: item.capacity,
      situation: item.situation,
    });
    this.localForm.markAsPristine();
    this.localForm.markAsUntouched();
  }
}
