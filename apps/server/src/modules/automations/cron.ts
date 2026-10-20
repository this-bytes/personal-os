/**
 * A small, dependency-free cron implementation.
 *
 * It supports the standard five fields (minute, hour, day of month, month,
 * day of week) with `*`, lists, ranges and steps. That covers the
 * scheduling needs of a personal automation system without pulling in a
 * scheduling library.
 */

export interface CronSchedule {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseField(field: string, min: number, max: number, names: string[] = []): Set<number> {
  const values = new Set<number>();

  for (const part of field.split(',')) {
    const [rangePart = '', stepPart] = part.split('/');
    const step = stepPart ? Number(stepPart) : 1;
    if (!Number.isFinite(step) || step <= 0) {
      throw new Error(`Invalid cron step "${stepPart}".`);
    }

    let start: number;
    let end: number;

    if (rangePart === '*' || rangePart === '?') {
      start = min;
      end = max;
    } else if (rangePart.includes('-')) {
      const [rawStart = '', rawEnd = ''] = rangePart.split('-');
      start = normalizeValue(rawStart, names);
      end = normalizeValue(rawEnd, names);
    } else {
      start = normalizeValue(rangePart, names);
      end = rangePart.includes('/') ? max : start;
    }

    if (start > end) {
      throw new Error(`Invalid cron range "${rangePart}".`);
    }

    for (let value = start; value <= end; value += step) {
      if (value < min || value > max) {
        throw new Error(`Cron value ${value} is outside ${min}-${max}.`);
      }
      values.add(value);
    }
  }

  if (values.size === 0) throw new Error(`Cron field "${field}" matched no values.`);
  return values;
}

function normalizeValue(raw: string, names: string[]): number {
  const value = raw.trim().toLowerCase();
  const nameIndex = names.indexOf(value);
  if (nameIndex >= 0) return nameIndex;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error(`Invalid cron value "${raw}".`);
  return numeric;
}

export function parseCron(expression: string): CronSchedule {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error('A cron expression must have five fields.');
  }
  return {
    minutes: parseField(fields[0] ?? '*', 0, 59),
    hours: parseField(fields[1] ?? '*', 0, 23),
    daysOfMonth: parseField(fields[2] ?? '*', 1, 31),
    months: parseField(fields[3] ?? '*', 1, 12, MONTHS),
    daysOfWeek: parseField(fields[4] ?? '*', 0, 7, DAYS),
  };
}

/** True when the given moment satisfies the cron expression. */
export function cronMatches(expression: string, date: Date): boolean {
  const schedule = parseCron(expression);
  const fields = fieldsOf(expression);
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  const daysOfWeek = new Set(schedule.daysOfWeek);
  if (daysOfWeek.has(7)) daysOfWeek.add(0);

  if (!schedule.minutes.has(minute)) return false;
  if (!schedule.hours.has(hour)) return false;
  if (!schedule.months.has(month)) return false;

  const dayOfMonthRestricted = !hasWildcard(fields[2]);
  const dayOfWeekRestricted = !hasWildcard(fields[4]);

  // Standard cron behaviour: when both day fields are restricted, either
  // one matching is enough.
  if (dayOfMonthRestricted && dayOfWeekRestricted) {
    return schedule.daysOfMonth.has(dayOfMonth) || daysOfWeek.has(dayOfWeek);
  }
  if (dayOfMonthRestricted) return schedule.daysOfMonth.has(dayOfMonth);
  if (dayOfWeekRestricted) return daysOfWeek.has(dayOfWeek);
  return true;
}

function fieldsOf(expression: string): string[] {
  return expression.trim().split(/\s+/);
}

function hasWildcard(field: string | undefined): boolean {
  if (!field) return true;
  return field === '*' || field === '?';
}

/**
 * The next moment after `from` that satisfies the expression.
 * Scans minute by minute up to one year ahead.
 */
export function nextCronTime(expression: string, from: Date): Date | null {
  const schedule = parseCron(expression);
  const fields = fieldsOf(expression);
  const candidate = new Date(from.getTime());
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  const limit = new Date(from.getTime() + 366 * 86_400_000);

  while (candidate.getTime() <= limit.getTime()) {
    if (schedule.months.has(candidate.getMonth() + 1)) {
      const dayOfMonthRestricted = !hasWildcard(fields[2]);
      const dayOfWeekRestricted = !hasWildcard(fields[4]);
      const daysOfWeek = new Set(schedule.daysOfWeek);
      if (daysOfWeek.has(7)) daysOfWeek.add(0);

      const dayMatches =
        dayOfMonthRestricted && dayOfWeekRestricted
          ? schedule.daysOfMonth.has(candidate.getDate()) || daysOfWeek.has(candidate.getDay())
          : dayOfMonthRestricted
            ? schedule.daysOfMonth.has(candidate.getDate())
            : dayOfWeekRestricted
              ? daysOfWeek.has(candidate.getDay())
              : true;

      if (
        dayMatches &&
        schedule.hours.has(candidate.getHours()) &&
        schedule.minutes.has(candidate.getMinutes())
      ) {
        return candidate;
      }
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  return null;
}

/**
 * Compute the next scheduled run for a trigger.
 * Manual and event triggers never fire on their own.
 */
export function computeNextRun(
  trigger: { type: string; cron?: string; everyMinutes?: number },
  from: Date,
): string | null {
  if (trigger.type === 'manual' || trigger.type === 'event') return null;
  if (trigger.everyMinutes) {
    return new Date(from.getTime() + trigger.everyMinutes * 60_000).toISOString();
  }
  if (trigger.cron) {
    const next = nextCronTime(trigger.cron, from);
    return next ? next.toISOString() : null;
  }
  return null;
}
