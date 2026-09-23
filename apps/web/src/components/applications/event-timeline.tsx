import type { ApplicationEvent, EventType } from '@jat/shared';
import {
  CalendarCheck,
  CheckCircle2,
  Code2,
  FileText,
  Mail,
  RefreshCw,
  Send,
  StickyNote,
  Trophy,
  Undo2,
  UserRound,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { EVENT_LABELS, STATUS_LABELS } from '@/lib/labels';

const EVENT_ICONS: Record<EventType, LucideIcon> = {
  APPLIED: Send,
  CONFIRMATION_RECEIVED: CheckCircle2,
  RECRUITER_CONTACT: UserRound,
  INTERVIEW_SCHEDULED: CalendarCheck,
  TECHNICAL_INTERVIEW_SCHEDULED: Code2,
  OFFER_RECEIVED: Trophy,
  REJECTED: XCircle,
  WITHDRAWN: Undo2,
  STATUS_CHANGED: RefreshCw,
  NOTE: StickyNote,
};

const SOURCE_ICONS = { EMAIL: Mail, MANUAL: FileText, SYSTEM: RefreshCw } as const;
const SOURCE_TEXT = { EMAIL: 'Email', MANUAL: 'Manual', SYSTEM: 'Automático' } as const;

/** Events newest first. */
export function EventTimeline({ events }: { events: ApplicationEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay eventos.</p>;
  }

  return (
    <ol className="relative space-y-6 border-l pl-6">
      {events.map((event) => {
        const Icon = EVENT_ICONS[event.type];
        const SourceIcon = SOURCE_ICONS[event.source];
        return (
          <li key={event.id} className="relative">
            <span className="absolute top-0 -left-[37px] flex size-6 items-center justify-center rounded-full border bg-background">
              <Icon className="size-3.5 text-muted-foreground" aria-hidden />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-sm font-medium">{EVENT_LABELS[event.type]}</p>
              <time dateTime={event.occurredAt} className="text-xs text-muted-foreground">
                {formatDateTime(event.occurredAt)}
              </time>
            </div>
            {event.summary && (
              <p className="mt-0.5 text-sm text-muted-foreground">{event.summary}</p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <SourceIcon className="size-3" aria-hidden />
                {SOURCE_TEXT[event.source]}
              </span>
              {event.fromStatus && event.toStatus && event.fromStatus !== event.toStatus && (
                <span>
                  {STATUS_LABELS[event.fromStatus]} → {STATUS_LABELS[event.toStatus]}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
