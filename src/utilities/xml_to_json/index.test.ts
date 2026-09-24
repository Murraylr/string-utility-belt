import { describe, it, expect } from 'vitest'
import util from './index'
import jsonToXml from '../json_to_xml/index'

describe('xml_to_json', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('xml_to_json')
    expect(util.name).toBe('xml to json')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['json', 'string'])
    expect(Object.keys(util.params).sort()).toEqual(
      ['attributePrefix', 'compact', 'indent', 'output', 'textKey'].sort()
    )
  })

  it('converts attributes, single children and repeated children', async () => {
    const out = await util.apply('<note id="1"><to>Tove</to><to>Jani</to><body>Hi</body></note>', {})
    expect(out).toEqual({ note: { '@id': '1', to: ['Tove', 'Jani'], body: 'Hi' } })
  })

  it('returns a real object, not a JSON string', async () => {
    const out = await util.apply('<a>1</a>', {})
    expect(typeof out).toBe('object')
    expect((out as any).a).toBe('1')
  })

  it('returns an empty object for empty input', async () => {
    expect(await util.apply('', {})).toEqual({})
    expect(await util.apply('  \n  ', {})).toEqual({})
  })

  it('handles unicode element names, attributes and astral text', async () => {
    const out = await util.apply('<café lang="fr">Crème 😀</café>', {})
    expect(out).toEqual({ café: { '@lang': 'fr', '#text': 'Crème 😀' } })
  })

  it('ignores indentation, comments and processing instructions but keeps CDATA', async () => {
    const xml = '<?xml version="1.0"?>\n<a>\n  <!-- note -->\n  <b><![CDATA[<raw> & stuff]]></b>\n</a>'
    expect(await util.apply(xml, {})).toEqual({ a: { b: '<raw> & stuff' } })
  })

  it('maps empty elements to empty strings', async () => {
    expect(await util.apply('<a><b/><c></c></a>', {})).toEqual({ a: { b: '', c: '' } })
  })

  it('honours compact = false by always emitting objects, arrays and the text key', async () => {
    const out = await util.apply('<a x="1"><b>1</b></a>', { compact: false })
    expect(out).toEqual({ a: { '@x': '1', b: [{ '#text': '1' }], '#text': '' } })
  })

  it('honours attributePrefix and textKey', async () => {
    const out = await util.apply('<t id="1">hi</t>', { attributePrefix: '_', textKey: 'value' })
    expect(out).toEqual({ t: { _id: '1', value: 'hi' } })
  })

  it('honours output = string with the requested indent', async () => {
    expect(await util.apply('<a>1</a>', { output: 'string', indent: 0 })).toBe('{"a":"1"}')
    expect(await util.apply('<a>1</a>', { output: 'string', indent: 2 })).toBe('{\n  "a": "1"\n}')
    expect(await util.apply('', { output: 'string', indent: 0 })).toBe('{}')
  })

  it('honours output = json explicitly', async () => {
    const out = await util.apply('<a>1</a>', { output: 'json', indent: 4 })
    expect(typeof out).toBe('object')
    expect(out).toEqual({ a: '1' })
  })

  it('accepts a document whose root element is genuinely named parsererror', async () => {
    // parse failures are detected by namespace, not by tag name
    expect(await util.apply('<parsererror>x</parsererror>', {})).toEqual({ parsererror: 'x' })
  })

  it('throws a clear error on malformed XML', async () => {
    expect(() => util.apply('<a><b></a>', {})).toThrow(/invalid XML/)
    expect(() => util.apply('just some text', {})).toThrow(/invalid XML/)
    expect(() => util.apply('<a attr=unquoted></a>', {})).toThrow(/invalid XML/)
  })

  it('round-trips json -> xml -> json, including unicode', async () => {
    const json = {
      catalog: {
        '@id': '1',
        item: [
          { '@sku': 'A-1', '#text': 'Café 😀' },
          { '@sku': 'B-2', '#text': 'Tea' }
        ]
      }
    }
    const xml = await jsonToXml.apply(json as any, {})
    expect(await util.apply(xml as any, {})).toEqual(json)
  })
})
