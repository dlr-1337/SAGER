import { signal } from '@angular/core';

export const IDLE_LIMIT_MS = 30 * 60_000;

/**
 * Recursive timeout, rescheduled only after the answer. Stopping on inactivity keeps polling from
 * holding the session of a shared workstation open.
 */
export class ConversationPolling {
  readonly state = signal<'running' | 'idle' | 'expired'>('running');
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastInteraction = Date.now();
  private inFlight = false;
  private destroyed = false;
  private readonly touch = () => {
    this.lastInteraction = Date.now();
  };
  private readonly visibility = () => {
    clearTimeout(this.timer);
    if (!this.doc.hidden) void this.run();
  };

  constructor(
    private readonly tick: () => Promise<void>,
    private readonly delayMs: number,
    private readonly doc: Document = document,
  ) {}

  start(): void {
    this.doc.addEventListener('visibilitychange', this.visibility);
    this.doc.addEventListener('pointerdown', this.touch);
    this.doc.addEventListener('keydown', this.touch);
    this.schedule();
  }
  resume(): void {
    this.touch();
    this.state.set('running');
    void this.run();
  }
  destroy(): void {
    this.destroyed = true;
    clearTimeout(this.timer);
    this.doc.removeEventListener('visibilitychange', this.visibility);
    this.doc.removeEventListener('pointerdown', this.touch);
    this.doc.removeEventListener('keydown', this.touch);
  }

  private schedule(): void {
    clearTimeout(this.timer);
    if (this.destroyed || this.doc.hidden || this.state() !== 'running') return;
    this.timer = setTimeout(() => void this.run(), this.delayMs);
  }
  private async run(): Promise<void> {
    if (this.inFlight || this.destroyed || this.doc.hidden || this.state() !== 'running') return;
    if (Date.now() - this.lastInteraction >= IDLE_LIMIT_MS) {
      this.state.set('idle');
      return;
    }
    this.inFlight = true;
    try {
      await this.tick();
    } catch (error) {
      if ((error as { status?: number }).status === 401) this.state.set('expired');
    }
    this.inFlight = false;
    this.schedule();
  }
}
