import { RRule, Frequency } from 'rrule';

/**
 * Map our simple recurrence enum to rrule frequencies.
 */
const FREQ_MAP: Record<string, Frequency> = {
  Daily: RRule.DAILY,
  Weekly: RRule.WEEKLY,
  Monthly: RRule.MONTHLY,
  Yearly: RRule.YEARLY,
};

export interface RecurrenceInstance {
  /** ISO string — start of this occurrence */
  startAt: string;
  /** ISO string — end of this occurrence (preserves original duration) */
  endAt: string | null;
  /** true when this is a virtual (expanded) instance, not the stored row */
  isVirtual: boolean;
}

/**
 * Expand a recurring calendar event into individual instances within a
 * date range.  Works with either:
 *   1. An RRULE string (`recurrenceRule`)
 *   2. A simple enum (`recurrence`) + optional `recurrenceEndDate`
 *
 * @returns Array of occurrence timestamps within [rangeStart, rangeEnd].
 *          Always includes the original event as the first instance.
 */
export function expandRecurrence(event: {
  startAt: string | Date;
  endAt?: string | Date | null;
  recurrence?: string | null;
  recurrenceRule?: string | null;
  recurrenceEndDate?: string | Date | null;
}, rangeStart: Date, rangeEnd: Date): RecurrenceInstance[] {
  const origStart = new Date(event.startAt);
  const origEnd = event.endAt ? new Date(event.endAt) : null;
  const durationMs = origEnd ? origEnd.getTime() - origStart.getTime() : 0;

  // No recurrence → return single instance
  if ((!event.recurrence || event.recurrence === 'None') && !event.recurrenceRule) {
    return [{
      startAt: origStart.toISOString(),
      endAt: origEnd?.toISOString() ?? null,
      isVirtual: false,
    }];
  }

  let rule: RRule;

  if (event.recurrenceRule) {
    // Parse full RRULE string
    try {
      rule = RRule.fromString(event.recurrenceRule);
      // Override dtstart if the RRULE doesn't contain it
      if (!event.recurrenceRule.includes('DTSTART')) {
        rule = new RRule({ ...rule.origOptions, dtstart: origStart });
      }
    } catch {
      // Malformed RRULE — return original only
      return [{
        startAt: origStart.toISOString(),
        endAt: origEnd?.toISOString() ?? null,
        isVirtual: false,
      }];
    }
  } else {
    // Build from simple enum
    const freq = FREQ_MAP[event.recurrence!];
    if (!freq && freq !== 0) {
      return [{
        startAt: origStart.toISOString(),
        endAt: origEnd?.toISOString() ?? null,
        isVirtual: false,
      }];
    }

    const until = event.recurrenceEndDate ? new Date(event.recurrenceEndDate) : undefined;
    rule = new RRule({
      freq,
      dtstart: origStart,
      until: until && until < rangeEnd ? until : rangeEnd,
    });
  }

  // Expand within the requested window (cap at 365 instances to prevent runaway)
  const occurrences = rule.between(rangeStart, rangeEnd, true).slice(0, 365);

  return occurrences.map((dt, i) => ({
    startAt: dt.toISOString(),
    endAt: durationMs ? new Date(dt.getTime() + durationMs).toISOString() : null,
    isVirtual: i > 0 || dt.getTime() !== origStart.getTime(),
  }));
}
