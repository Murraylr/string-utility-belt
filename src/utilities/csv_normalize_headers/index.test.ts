import { describe, it, expect } from 'vitest'
import util from './index'

const CSV = 'First Name,Last  Name,E-Mail\nAda,Lovelace,ada@example.com'

describe('csv_normalize_headers', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('csv_normalize_headers')
    expect(util.name).toBe('csv normalize headers')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['dedupe', 'delimiter', 'style'])
  })

  it('snake-cases the header row by default and leaves data alone', async () => {
    expect(await util.apply(CSV, {})).toBe(
      'first_name,last_name,e_mail\nAda,Lovelace,ada@example.com'
    )
  })

  it('supports every style option', async () => {
    const head = async (style: string) => String(await util.apply(CSV, { style })).split('\n')[0]
    expect(await head('snake')).toBe('first_name,last_name,e_mail')
    expect(await head('camel')).toBe('firstName,lastName,eMail')
    expect(await head('kebab')).toBe('first-name,last-name,e-mail')
    expect(await head('pascal')).toBe('FirstName,LastName,EMail')
    expect(await head('title')).toBe('First Name,Last Name,E Mail')
    expect(await head('lower')).toBe('first name,last  name,e-mail')
    expect(await head('upper')).toBe('FIRST NAME,LAST  NAME,E-MAIL')
  })

  it('de-duplicates repeated names, and leaves them alone when dedupe is off', async () => {
    expect(await util.apply('a,a,A\n1,2,3', { style: 'snake' })).toBe('a,a_2,a_3\n1,2,3')
    expect(await util.apply('a,a,A\n1,2,3', { style: 'snake', dedupe: false })).toBe('a,a,a\n1,2,3')
    expect(await util.apply('user id,User ID\n1,2', { style: 'camel' })).toBe('userId,userId2\n1,2')
    expect(await util.apply('user id,User ID\n1,2', { style: 'kebab' })).toBe(
      'user-id,user-id-2\n1,2'
    )
    expect(await util.apply('user id,User ID\n1,2', { style: 'title' })).toBe(
      'User Id,User Id 2\n1,2'
    )
  })

  it('names empty or symbol-only header cells after their position', async () => {
    expect(await util.apply('a,,c\n1,2,3', { style: 'snake' })).toBe('a,column_2,c\n1,2,3')
    expect(await util.apply('a,😀\n1,2', { style: 'pascal' })).toBe('A,Column2\n1,2')
  })

  it('keeps non-ASCII letters intact', async () => {
    expect(await util.apply('Prénom,Âge\nJosé,30', { style: 'snake' })).toBe(
      'prénom,âge\nJosé,30'
    )
    expect(await util.apply('Prénom,Âge\nJosé,30', { style: 'camel' })).toBe('prénom,âge\nJosé,30')
  })

  it('honours an explicit delimiter and auto-detection', async () => {
    expect(await util.apply('First Name;Age\nAda;36', { delimiter: ';' })).toBe(
      'first_name;age\nAda;36'
    )
    expect(await util.apply('First Name\tAge\nAda\t36', { delimiter: 'auto' })).toBe(
      'first_name\tage\nAda\t36'
    )
    expect(await util.apply('First Name\tAge\nAda\t36', { delimiter: '\\t' })).toBe(
      'first_name\tage\nAda\t36'
    )
  })

  it('re-quotes header names that need it and preserves line endings', async () => {
    expect(await util.apply('"a b",c\n1,2', { style: 'lower' })).toBe('a b,c\n1,2')
    expect(await util.apply('"a,b",c\n1,2', { style: 'lower' })).toBe('"a,b",c\n1,2')
    expect(await util.apply('A B,C\r\n1,2', {})).toBe('a_b,c\r\n1,2')
    expect(await util.apply('A B,C\n1,2\n', {})).toBe('a_b,c\n1,2\n')
  })

  it('handles empty input without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   ', { style: 'camel' })).toBe('')
  })

  it('throws on malformed CSV', () => {
    expect(() => util.apply('a,b\n"oops,1', {})).toThrow(/unterminated quoted field/)
  })
})
