export interface HabitTimer {
  habitId: string;
  dateKey: string;
  targetSec: number;
  remainingMs: number;
  endsAt: number | null;
}

export interface TimerSnapshot {
  remaining: number;
  running: boolean;
  dateKey: string;
}

/** Deadlines survive suspended JavaScript, screen locks and process restarts. */
export class HabitTimers {
  private sessions = new Map<string, HabitTimer>();
  private reported = new Map<string, string>();

  constructor(
    private now: () => number,
    private onProgress: (timer: HabitTimer, elapsed: number) => void,
    private onChange: () => void,
    private persist: (timers: HabitTimer[]) => void,
  ) {}

  private milliseconds(timer: HabitTimer): number {
    return Math.max(0, timer.endsAt === null ? timer.remainingMs : timer.endsAt - this.now());
  }

  get(habitId: string): TimerSnapshot | undefined {
    const timer = this.sessions.get(habitId);
    if (!timer) return undefined;
    const remaining = Math.ceil(this.milliseconds(timer) / 1000);
    return { remaining, running: timer.endsAt !== null && remaining > 0, dateKey: timer.dateKey };
  }

  private save() { this.persist([...this.sessions.values()].map(timer => ({ ...timer }))); }

  private report(timer: HabitTimer): boolean {
    const remaining = Math.ceil(this.milliseconds(timer) / 1000);
    const signature = `${timer.dateKey}/${remaining}/${timer.endsAt !== null}`;
    if (this.reported.get(timer.habitId) === signature) return false;
    this.reported.set(timer.habitId, signature);
    this.onProgress(timer, Math.max(0, timer.targetSec - remaining));
    return true;
  }

  restore(value: unknown) {
    this.sessions.clear();
    this.reported.clear();
    if (Array.isArray(value)) for (const item of value) {
      if (!item || typeof item.habitId !== 'string' || !item.habitId ||
        typeof item.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.dateKey) ||
        !Number.isFinite(item.targetSec) || item.targetSec <= 0 ||
        !Number.isFinite(item.remainingMs) || item.remainingMs < 0 ||
        (item.endsAt !== null && (!Number.isFinite(item.endsAt) || item.endsAt < 0))) continue;
      this.sessions.set(item.habitId, { habitId: item.habitId, dateKey: item.dateKey,
        targetSec: item.targetSec, remainingMs: item.remainingMs, endsAt: item.endsAt });
    }
  }

  retain(valid: (timer: HabitTimer) => boolean) {
    let changed = false;
    for (const [id, timer] of this.sessions) if (!valid(timer)) {
      this.sessions.delete(id); this.reported.delete(id); changed = true;
    }
    if (changed) { this.save(); this.onChange(); }
  }

  tick() {
    let changed = false, finished = false;
    for (const timer of this.sessions.values()) {
      if (timer.endsAt !== null && this.milliseconds(timer) === 0) {
        timer.endsAt = null; timer.remainingMs = 0; finished = true;
      }
      changed = this.report(timer) || changed;
    }
    if (finished) this.save();
    if (changed) this.onChange();
  }

  private fallback(habitId: string, dateKey: string, targetSec: number, remaining: number): HabitTimer {
    return { habitId, dateKey, targetSec, remainingMs: Math.max(0, remaining * 1000), endsAt: null };
  }

  toggle(habitId: string, dateKey: string, targetSec: number, initialRemaining: number) {
    let timer = this.sessions.get(habitId);
    if (!timer || this.milliseconds(timer) === 0) {
      timer = this.fallback(habitId, dateKey, targetSec, timer ? targetSec : initialRemaining);
    }
    if (timer.endsAt !== null) {
      timer.remainingMs = this.milliseconds(timer);
      timer.endsAt = null;
    } else {
      timer.endsAt = this.now() + timer.remainingMs;
    }
    this.sessions.set(habitId, timer);
    this.save(); this.report(timer); this.onChange();
  }

  adjust(habitId: string, dateKey: string, targetSec: number, initialRemaining: number, delta: number) {
    const timer = this.sessions.get(habitId) || this.fallback(habitId, dateKey, targetSec, initialRemaining);
    timer.remainingMs = Math.max(0, this.milliseconds(timer) + delta * 1000);
    if (timer.endsAt !== null) timer.endsAt = timer.remainingMs > 0 ? this.now() + timer.remainingMs : null;
    this.sessions.set(habitId, timer);
    this.save(); this.report(timer); this.onChange();
  }

  reset(habitId: string, dateKey: string, targetSec: number, completed = false) {
    const timer = this.fallback(habitId, dateKey, targetSec, completed ? 0 : targetSec);
    this.sessions.set(habitId, timer);
    this.reported.delete(habitId);
    this.save(); this.report(timer); this.onChange();
  }
}
