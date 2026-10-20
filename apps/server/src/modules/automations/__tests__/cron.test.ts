import { describe, expect, it } from 'vitest';
import { cronMatches, nextCronTime, parseCron } from '../cron.js';

describe('cron parsing', () => {
  it('parses a standard five field expression', () => {
    const schedule = parseCron('30 4 * * *');
    expect(schedule.minutes.has(30)).toBe(true);
    expect(schedule.hours.has(4)).toBe(true);
    expect(schedule.daysOfMonth.size).toBe(31);
  });

  it('supports lists, ranges and steps', () => {
    const schedule = parseCron('0,30 9-17 * * mon-fri');
    expect([...schedule.minutes].sort((a, b) => a - b)).toEqual([0, 30]);
    expect(schedule.hours.size).toBe(9);
    expect(schedule.daysOfWeek.has(1)).toBe(true);
    expect(schedule.daysOfWeek.has(5)).toBe(true);
    expect(schedule.daysOfWeek.has(0)).toBe(false);
  });

  it('supports step values', () => {
    const schedule = parseCron('*/15 * * * *');
    expect([...schedule.minutes].sort((a, b) => a - b)).toEqual([0, 15, 30, 45]);
  });

  it('rejects an expression with the wrong number of fields', () => {
    expect(() => parseCron('30 4 * *')).toThrow(/five fields/i);
  });

  it('rejects out of range values', () => {
    expect(() => parseCron('99 * * * *')).toThrow(/outside/i);
  });
});

describe('cron matching', () => {
  it('matches an exact minute and hour', () => {
    expect(cronMatches('30 4 * * *', new Date(2026, 0, 1, 4, 30))).toBe(true);
    expect(cronMatches('30 4 * * *', new Date(2026, 0, 1, 4, 31))).toBe(false);
  });

  it('matches weekday restrictions', () => {
    // 2026-01-05 is a Monday.
    expect(cronMatches('0 9 * * mon', new Date(2026, 0, 5, 9, 0))).toBe(true);
    // 2026-01-07 is a Wednesday.
    expect(cronMatches('0 9 * * mon', new Date(2026, 0, 7, 9, 0))).toBe(false);
  });
});

describe('next cron time', () => {
  it('finds the next matching moment', () => {
    const from = new Date(2026, 0, 1, 4, 0, 0);
    const next = nextCronTime('30 4 * * *', from);
    expect(next).not.toBeNull();
    expect(next?.getHours()).toBe(4);
    expect(next?.getMinutes()).toBe(30);
  });

  it('rolls over to the next day', () => {
    const from = new Date(2026, 0, 1, 5, 0, 0);
    const next = nextCronTime('30 4 * * *', from);
    expect(next?.getDate()).toBe(2);
    expect(next?.getHours()).toBe(4);
  });
});
