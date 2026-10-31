import { Component, input } from '@angular/core';

export interface TimelineEvent {
  label: string;
  date?: string;
  detail?: string;
  state?: 'done' | 'current' | 'pending';
}

@Component({
  selector: 'app-timeline',
  standalone: true,
  template: `
    <ol class="timeline" [attr.aria-label]="ariaLabel()">
      @for (event of events(); track $index) {
        <li [class.pending]="event.state === 'pending'" [class.current]="event.state === 'current'">
          <span class="point" aria-hidden="true"></span>
          <div class="event-copy">
            <strong>{{ event.label }}</strong>
            @if (event.date) {
              <time>{{ event.date }}</time>
            }
            @if (event.detail) {
              <p>{{ event.detail }}</p>
            }
          </div>
        </li>
      }
    </ol>
  `,
  styles: [
    `
      .timeline {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      li {
        display: grid;
        grid-template-columns: 20px minmax(0, 1fr);
        gap: 15px;
        padding-bottom: 26px;
        position: relative;
      }
      li:not(:last-child)::before {
        content: '';
        position: absolute;
        top: 14px;
        bottom: 0;
        left: 8px;
        width: 2px;
        background: var(--line);
      }
      li:last-child {
        padding-bottom: 0;
      }
      .point {
        width: 17px;
        height: 17px;
        border-radius: 50%;
        background: var(--green-800);
        margin-top: 4px;
      }
      li.current .point {
        box-shadow: 0 0 0 4px var(--green-100);
      }
      li.pending .point {
        background: #b8c5c7;
      }
      .event-copy {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      strong {
        font-size: 1rem;
      }
      time {
        color: var(--muted);
        font-size: 1rem;
      }
      p {
        margin: 3px 0 0;
        color: var(--muted);
      }
    `,
  ],
})
export class TimelineComponent {
  readonly events = input.required<TimelineEvent[]>();
  readonly ariaLabel = input('Histórico da solicitação');
}
