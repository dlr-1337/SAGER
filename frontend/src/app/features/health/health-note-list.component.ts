import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HealthNoteSummary, categoryLabels, professionLabels } from './health.models';

@Component({
  selector: 'app-health-note-list',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './health.scss',
  template: `
    @if (notes().length === 0) {
      <div class="health-state">
        <h3>Nenhum registro disponível</h3>
        <p class="muted">Não há registros acessíveis nesta consulta.</p>
      </div>
    } @else {
      <ul class="health-list" aria-label="Registros de saúde">
        @for (note of notes(); track note.id) {
          <li class="health-row">
            <div>
              <h3>{{ categories[note.category] }}</h3>
              <p>{{ note.authorName }} · {{ professions[note.authorProfession] }}</p>
              <p class="health-meta">
                {{ note.updatedAt | date: 'dd/MM/yyyy HH:mm' }}
              </p>
              @if (note.custodyAccess && !own()) {
                <p class="health-meta">Acesso por custódia</p>
              }
            </div>
            @if (own()) {
              <button
                type="button"
                class="btn-secondary"
                (click)="selected.emit(note.id)"
                [attr.aria-label]="'Abrir ' + categories[note.category] + ' de ' + note.authorName"
              >
                Abrir registro
              </button>
            } @else {
              <a
                class="btn-secondary"
                [routerLink]="['/saude/notas', note.id]"
                [attr.aria-label]="'Abrir ' + categories[note.category] + ' de ' + note.authorName"
                >Abrir registro</a
              >
            }
          </li>
        }
      </ul>
    }
  `,
})
export class HealthNoteListComponent {
  readonly notes = input.required<HealthNoteSummary[]>();
  readonly own = input(false);
  readonly selected = output<string>();
  readonly categories = categoryLabels;
  readonly professions = professionLabels;
}
