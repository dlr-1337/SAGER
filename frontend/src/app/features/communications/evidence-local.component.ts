import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DisciplineOccurrence } from './communications-local.models';
import {
  categoryLabels,
  evidenceRows,
  formatCommunicationTime,
  sourceLabels,
} from './communications-local.utils';

@Component({
  standalone: true,
  selector: 'sager-local-evidence',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel op-panel" aria-labelledby="source-evidence-title">
      <h2 id="source-evidence-title">O que aconteceu</h2>
      <dl class="comm-definition">
        <div>
          <dt>Origem</dt>
          <dd>{{ sources[occurrence.sourceType] || 'Origem registrada' }}</dd>
        </div>
        <div>
          <dt>Categoria</dt>
          <dd>{{ categories[occurrence.category] }}</dd>
        </div>
        <div>
          <dt>Ocorrido em</dt>
          <dd>{{ formatTime(occurrence.occurredAt) }}</dd>
        </div>
        <div>
          <dt>Situação</dt>
          <dd>
            {{ occurrence.valid ? 'Válida para análise' : 'Origem invalidada ou corrigida' }}
          </dd>
        </div>
        @for (row of rows(occurrence.evidence); track row.label) {
          <div>
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        }
      </dl>
      <details>
        <summary>Histórico de correções</summary>
        <ol class="comm-history">
          @for (revision of occurrence.revisions; track revision.version) {
            <li>
              <strong>{{ revision.valid ? 'Válida' : 'Invalidada' }}</strong
              ><time [attr.datetime]="revision.recordedAt"
                >Registrada em {{ formatTime(revision.recordedAt) }}</time
              >
              <p>Fato ocorrido em {{ formatTime(revision.occurredAt) }}.</p>
              <dl class="comm-definition">
                @for (row of rows(revision.evidence); track row.label) {
                  <div>
                    <dt>{{ row.label }}</dt>
                    <dd>{{ row.value }}</dd>
                  </div>
                }
              </dl>
            </li>
          } @empty {
            <li>Nenhuma correção anterior.</li>
          }
        </ol>
      </details>
    </section>
  `,
  styleUrl: './communications-local.scss',
})
export class EvidenceLocalComponent {
  @Input({ required: true }) occurrence!: DisciplineOccurrence;
  readonly sources = sourceLabels;
  readonly categories = categoryLabels;
  readonly rows = evidenceRows;
  readonly formatTime = formatCommunicationTime;
}
