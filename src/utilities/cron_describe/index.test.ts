import { describe, it, expect } from 'vitest'
import util from './index'

describe('cron_describe', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('cron_describe')
    expect(util.name).toBe('cron describe')
    expect(util.category).toBe('Date & Time')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
    expect(Object.keys(util.params).sort()).toEqual(
      ['dayOfWeekStartIndexZero', 'format', 'locale', 'seconds', 'use24Hour', 'verbose'].sort()
    )
  })

  it('describes a realistic expression with a field table', async () => {
    const out = String(await util.apply('30 9 * * 1-5', {}))
    expect(out.split('\n')[0]).toBe('At 09:30, Monday through Friday')
    expect(out).toContain('minute        30   minute 30')
    expect(out).toContain('day of week   1-5  Monday through Friday')
    expect(out).toContain('day of month  *    every day of the month')
  })

  it('returns a real object in json format', async () => {
    const out: any = await util.apply('*/5 * * * *', { format: 'json' })
    expect(typeof out).toBe('object')
    expect(Array.isArray(out)).toBe(false)
    expect(out.expression).toBe('*/5 * * * *')
    expect(out.description).toBe('Every 5 minutes')
    expect(out.fields).toHaveLength(5)
    expect(out.fields[0]).toEqual({ field: 'minute', value: '*/5', description: 'every 5 minutes' })
    expect(out.fields[4]).toEqual({
      field: 'day of week',
      value: '*',
      description: 'every day of the week'
    })
  })

  it('handles empty input without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n  ', { format: 'text' })).toBe('')
    expect(await util.apply('', { format: 'json' })).toEqual({})
  })

  it('speaks every offered locale', async () => {
    // Exact strings for every locale — a `toContain('00:00')` check would also pass if the
    // i18n build silently fell back to English, so each locale is pinned to its own wording.
    const expected: Record<string, string> = {
      en: 'At 00:00, only on Monday',
      es: 'A las 00:00, sólo el lunes',
      fr: 'À 00:00, uniquement le lundi',
      de: 'Um 00:00, nur jeden Montag',
      it: 'Alle 00:00, solo il lunedì',
      nl: 'Om 00:00, alleen op maandag',
      pt_BR: 'Às 00:00, somente de segunda-feira'
    }
    for (const locale of ['en', 'es', 'fr', 'de', 'it', 'nl', 'pt_BR']) {
      const out: any = await util.apply('0 0 * * 1', { locale, format: 'json' })
      expect(out.description).toBe(expected[locale])
      // the breakdown stays in English regardless of the locale of the sentence
      expect(out.fields[4].description).toBe('Monday')
    }
  })

  it('honours verbose, use24Hour and dayOfWeekStartIndexZero in both states', async () => {
    const desc = async (p: any) => String((await util.apply('*/5 * * * *', { ...p, format: 'json' }) as any).description)
    expect(await desc({ verbose: false })).toBe('Every 5 minutes')
    expect(await desc({ verbose: true })).toBe('Every 5 minutes, every hour, every day')

    const at2pm = async (use24Hour: boolean) =>
      String((await util.apply('0 14 * * *', { use24Hour, format: 'json' }) as any).description)
    expect(await at2pm(true)).toBe('At 14:00')
    expect(await at2pm(false)).toBe('At 02:00 PM')

    const zero: any = await util.apply('0 0 * * 1', { dayOfWeekStartIndexZero: true, format: 'json' })
    expect(zero.fields[4].description).toBe('Monday')
    const oneBased: any = await util.apply('0 0 * * 1', {
      dayOfWeekStartIndexZero: false,
      format: 'json'
    })
    expect(oneBased.fields[4].description).toBe('Sunday')
  })

  it('adds a seconds field when asked, and leaves 6-field expressions alone', async () => {
    const without: any = await util.apply('30 9 * * 1-5', { seconds: false, format: 'json' })
    expect(without.fields.map((f: any) => f.field)).toEqual([
      'minute',
      'hour',
      'day of month',
      'month',
      'day of week'
    ])
    const withSeconds: any = await util.apply('30 9 * * 1-5', { seconds: true, format: 'json' })
    expect(withSeconds.expression).toBe('0 30 9 * * 1-5')
    expect(withSeconds.fields[0]).toEqual({ field: 'second', value: '0', description: 'second 0' })
    expect(withSeconds.description).toBe('At 09:30, Monday through Friday')

    const alreadySix: any = await util.apply('0 30 9 * * 1-5', { seconds: true, format: 'json' })
    expect(alreadySix.expression).toBe('0 30 9 * * 1-5')
  })

  it('resolves @aliases, quartz specials and 7-field expressions', async () => {
    const weekly: any = await util.apply('@weekly', { format: 'json' })
    expect(weekly.description).toBe('At 00:00, only on Sunday')
    expect(await util.apply('@reboot', { format: 'json' })).toEqual({
      expression: '@reboot',
      description: 'At system startup',
      fields: [{ field: 'special', value: '@reboot', description: 'At system startup' }]
    })
    const last: any = await util.apply('0 0 L * *', { format: 'json' })
    expect(last.fields[2].description).toBe('the last day of the month')
    const lw: any = await util.apply('0 0 LW * *', { format: 'json' })
    expect(lw.fields[2].description).toBe('the last weekday of the month')
    const offset: any = await util.apply('0 0 L-3 * *', { format: 'json' })
    expect(offset.fields[2].description).toBe('3 days before the last day of the month')
    const oneDay: any = await util.apply('0 0 L-1 * *', { format: 'json' })
    expect(oneDay.fields[2].description).toBe('1 day before the last day of the month')
    const nearest: any = await util.apply('0 0 15W * *', { format: 'json' })
    expect(nearest.fields[2].description).toBe('the weekday nearest day 15')
    const lastFri: any = await util.apply('0 0 * * 5L', { format: 'json' })
    expect(lastFri.fields[4].description).toBe('the last Friday of the month')
    const nth: any = await util.apply('0 0 * * 5#2', { format: 'json' })
    expect(nth.fields[4].description).toBe('the second Friday of the month')
    const withYear: any = await util.apply('0 0 1 1 * 2030', { format: 'json' })
    expect(withYear.fields.map((f: any) => f.field)).toEqual([
      'minute',
      'hour',
      'day of month',
      'month',
      'day of week',
      'year'
    ])
    const sevenFields: any = await util.apply('* * * * * * *', { format: 'json' })
    expect(sevenFields.fields).toHaveLength(7)
  })

  it('describes lists, ranges and steps in plain English', async () => {
    const mixed: any = await util.apply('0 0,30 8-17 * 1,6 *', { format: 'json' })
    expect(mixed.fields[1].description).toBe('minutes 0 and 30')
    expect(mixed.fields[2].description).toBe('hours 8 through 17')
    expect(mixed.fields[4].description).toBe('January and June')
    const mixedDow: any = await util.apply('0 0 * * 1-5,0', { format: 'json' })
    expect(mixedDow.fields[4].description).toBe('Monday through Friday and Sunday')
    const stepped: any = await util.apply('0 5/15 * * *', { format: 'json' })
    expect(stepped.fields[1].description).toBe('every 15 hours starting at hour 5')
    const question: any = await util.apply('0 30 9 1,15 * ?', { format: 'json' })
    expect(question.fields[5].description).toBe('any day of week (no specific value)')
  })

  it('the field breakdown never contradicts the cronstrue sentence', async () => {
    // cronstrue is the independent oracle here: if our weekday/month tables were off by
    // one, our field text would no longer appear inside cronstrue's own description.
    for (const zeroBased of [true, false]) {
      const lo = zeroBased ? 0 : 1
      for (let n = lo; n <= lo + 6; n++) {
        const out: any = await util.apply(`0 0 * * ${n}`, {
          format: 'json',
          dayOfWeekStartIndexZero: zeroBased
        })
        expect(out.description).toContain(out.fields[4].description)
      }
    }
    for (let m = 1; m <= 12; m++) {
      const out: any = await util.apply(`0 0 1 ${m} *`, { format: 'json' })
      expect(out.description).toContain(out.fields[3].description)
    }
    for (let d = 0; d <= 6; d++) {
      const nth: any = await util.apply(`0 0 * * ${d}#3`, { format: 'json' })
      expect(nth.description).toContain(nth.fields[4].description)
    }
  })

  it('throws a clear message on malformed input, including non-ASCII fields', async () => {
    await expect(util.apply('* * *', {})).rejects.toThrow(/at least 5 fields/)
    await expect(util.apply('99 * * * *', {})).rejects.toThrow(/invalid cron expression/)
    await expect(util.apply('😀 * * * *', {})).rejects.toThrow(/😀/)
    await expect(util.apply('* * * * * * * *', {})).rejects.toThrow(/at most 7 fields/)
    await expect(util.apply('@nonsense', {})).rejects.toThrow(/invalid cron expression/)
  })
})
