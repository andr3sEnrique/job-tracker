import type { ApplicationStatus, EventType } from '@jat/shared';
import { resolveAutomaticTransition } from './status-machine.js';

export interface TimelineEvent {
  type: EventType;
  toStatus: ApplicationStatus | null;
  occurredAt: Date;
}

/**
 * Replays an application's history in chronological order to derive its status.
 * - Explicit status changes (manual edits, the GHOSTED job) set the status directly.
 * - Everything else goes through the forward-only state machine.
 * Deriving instead of patching makes out-of-order emails and "undo" (removing an event)
 * produce the same result as if history had arrived in order.
 */
export function deriveStatus(events: readonly TimelineEvent[]): ApplicationStatus {
  const ordered = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  let status: ApplicationStatus = 'APPLIED';
  for (const event of ordered) {
    if (event.type === 'STATUS_CHANGED' && event.toStatus) {
      status = event.toStatus;
      continue;
    }
    status = resolveAutomaticTransition(status, event.type) ?? status;
  }
  return status;
}
