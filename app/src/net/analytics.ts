// Gameplay telemetry: the funnel that decides what to fix next.
//
// Fire and forget by design. Events are queued in memory, flushed in batches, and dropped entirely
// if the server is unreachable — a telemetry problem must never cost a frame or block a battle.
// Nothing here identifies a person: the id is the random one the save already generates, and the
// player can switch it all off in Settings.
import { CONFIG } from '../platform/config';

export type EventName =
  | 'session_start' | 'session_end'
  | 'ftue_step' | 'ftue_done'
  | 'battle_start' | 'battle_end' | 'level_cleared'
  | 'spell_discovered' | 'duel_end'
  | 'shop_view' | 'purchase_attempt' | 'purchase_complete' | 'ad_watched';

interface QueuedEvent { t: number; name: EventName; props: Record<string, unknown> }

const FLUSH_MS = 20_000;
/** Past this the player is offline or the server is down; keep the newest and drop the rest. */
const QUEUE_MAX = 120;

function randomId(): string {
  const b = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

class Analytics {
  private queue: QueuedEvent[] = [];
  private deviceId = '';
  private sessionId = randomId();
  private sessionStart = 0;
  private enabled = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Called once the save is loaded, so the opt-out is respected from the very first event. */
  start(deviceId: string, enabled: boolean): void {
    this.deviceId = deviceId;
    this.enabled = enabled;
    if (!enabled) return;
    this.sessionId = randomId();
    this.sessionStart = Date.now();
    this.track('session_start', { version: CONFIG.version });
    if (!this.timer) this.timer = setInterval(() => void this.flush(), FLUSH_MS);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) { this.queue = []; if (this.timer) { clearInterval(this.timer); this.timer = null; } }
    else this.start(this.deviceId, true);
  }

  track(name: EventName, props: Record<string, unknown> = {}): void {
    if (!this.enabled) return;
    this.queue.push({ t: Date.now(), name, props });
    if (this.queue.length > QUEUE_MAX) this.queue.splice(0, this.queue.length - QUEUE_MAX);
  }

  /** Sent when the app goes to the background, which on a phone is how most sessions end. */
  endSession(): void {
    if (!this.enabled) return;
    this.track('session_end', { seconds: Math.round((Date.now() - this.sessionStart) / 1000) });
    void this.flush(true);
  }

  async flush(final = false): Promise<void> {
    if (!this.enabled || !this.queue.length || !CONFIG.serverUrl) return;
    const batch = this.queue;
    this.queue = [];
    const body = JSON.stringify({ deviceId: this.deviceId, sessionId: this.sessionId, events: batch });
    try {
      // keepalive lets the last batch survive the app being backgrounded.
      const res = await fetch(`${CONFIG.serverUrl}/api/events`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: final,
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      // Put them back, newest-last, so a flaky connection does not lose the funnel.
      if (!final) this.queue = [...batch, ...this.queue].slice(-QUEUE_MAX);
    }
  }
}

export const analytics = new Analytics();
