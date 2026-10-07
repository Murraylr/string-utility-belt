import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'

/** 10-digit epoch seconds or 13-digit epoch milliseconds from 2008-01-10 to 2033-05-18, optional fraction. */
const EPOCH = '^1[2-9]\\d{8}(?:\\d{3})?(?:\\.\\d+)?$'

const recipe: Recipe = {
  slug: 'convert-unix-timestamps-in-json',
  name: 'Convert Unix timestamps in a JSON response to dates',
  summary:
    'Paste an API response and get the same JSON back with every epoch seconds or milliseconds value turned into an ISO 8601 date, at any depth, while ids, prices and phone numbers stay as they are.',
  category: 'Web & APIs',
  primaryQuery: 'convert unix timestamps in json to dates',
  published: '2026-10-08',
  related: ['unescape-stringified-json', 'nested-json-to-csv'],
  steps: [
    step('flatten', 'json_flatten', { arrayNotation: 'bracket', indent: 2 },
      'Turns the response into one path per value, such as data[0].created_at, so the next step reaches timestamps at any depth, inside a top-level array too. Keys containing dots or brackets are quoted, so they rebuild exactly.',
      { label: 'flatten to paths' }),
    each('convert', { mode: 'json-values' }, [
      laneStep('to-iso', 'timestamp_convert', { to: 'iso', timezone: 'UTC' }, { condition: { kind: 'regex', pattern: EPOCH } }),
    ],
      'Converts each value on its own, but only a 10-digit seconds or 13-digit milliseconds number between 2008 and 2033. Ids, prices, phone numbers, byte counts and expires_in durations do not match, so they are left untouched.',
      { label: 'convert epoch values' }),
    step('unflatten', 'json_unflatten', { indent: 2 },
      'Rebuilds the nesting from the paths, in the original key order, so you get the response back in its own shape with readable dates where the numbers were.',
      { label: 'rebuild the JSON' }),
  ],
  samples: [
    {
      id: 'orders-list',
      title: 'List endpoint (epoch seconds)',
      input: "{\n  \"data\": [\n    {\n      \"id\": 48213,\n      \"status\": \"shipped\",\n      \"amount\": 4999,\n      \"currency\": \"usd\",\n      \"created_at\": 1790848800,\n      \"shipped_at\": 1790942522,\n      \"customer\": {\n        \"name\": \"Dana Whitfield\",\n        \"phone\": \"4155550123\"\n      }\n    },\n    {\n      \"id\": 48214,\n      \"status\": \"pending\",\n      \"amount\": 1250,\n      \"currency\": \"usd\",\n      \"created_at\": 1790856061,\n      \"shipped_at\": null,\n      \"customer\": {\n        \"name\": \"Luis Ortega\",\n        \"phone\": \"2025550147\"\n      }\n    }\n  ],\n  \"has_more\": true,\n  \"next_cursor\": \"b3JkZXI6NDgyMTQ\"\n}\n",
      output: "{\n  \"data\": [\n    {\n      \"id\": 48213,\n      \"status\": \"shipped\",\n      \"amount\": 4999,\n      \"currency\": \"usd\",\n      \"created_at\": \"2026-10-01T10:00:00.000Z\",\n      \"shipped_at\": \"2026-10-02T12:02:02.000Z\",\n      \"customer\": {\n        \"name\": \"Dana Whitfield\",\n        \"phone\": \"4155550123\"\n      }\n    },\n    {\n      \"id\": 48214,\n      \"status\": \"pending\",\n      \"amount\": 1250,\n      \"currency\": \"usd\",\n      \"created_at\": \"2026-10-01T12:01:01.000Z\",\n      \"shipped_at\": null,\n      \"customer\": {\n        \"name\": \"Luis Ortega\",\n        \"phone\": \"2025550147\"\n      }\n    }\n  ],\n  \"has_more\": true,\n  \"next_cursor\": \"b3JkZXI6NDgyMTQ\"\n}",
    },
    {
      id: 'events-array',
      title: 'Top-level array (milliseconds)',
      input: "[\n  {\n    \"event\": \"login\",\n    \"user_id\": 1042,\n    \"ip\": \"203.0.113.24\",\n    \"ts\": 1790848800123\n  },\n  {\n    \"event\": \"export_started\",\n    \"user_id\": 1042,\n    \"ip\": \"203.0.113.24\",\n    \"ts\": 1790848865410\n  },\n  {\n    \"event\": \"export_failed\",\n    \"user_id\": 1042,\n    \"ip\": \"203.0.113.24\",\n    \"ts\": 1790848901007,\n    \"error_code\": 413,\n    \"size_bytes\": 1073741824\n  }\n]\n",
      output: "[\n  {\n    \"event\": \"login\",\n    \"user_id\": 1042,\n    \"ip\": \"203.0.113.24\",\n    \"ts\": \"2026-10-01T10:00:00.123Z\"\n  },\n  {\n    \"event\": \"export_started\",\n    \"user_id\": 1042,\n    \"ip\": \"203.0.113.24\",\n    \"ts\": \"2026-10-01T10:01:05.410Z\"\n  },\n  {\n    \"event\": \"export_failed\",\n    \"user_id\": 1042,\n    \"ip\": \"203.0.113.24\",\n    \"ts\": \"2026-10-01T10:01:41.007Z\",\n    \"error_code\": 413,\n    \"size_bytes\": 1073741824\n  }\n]",
    },
    {
      id: 'token-response',
      title: 'OAuth token response',
      input: "{\n  \"access_token\": \"at_7Qm2vX9kLp4RzT8wN3bY\",\n  \"token_type\": \"Bearer\",\n  \"expires_in\": 3600,\n  \"expires_at\": 1790852400,\n  \"issued_at\": \"1790848800\",\n  \"refresh_expires_in\": 2592000,\n  \"scope\": \"orders:read orders:write\"\n}\n",
      output: "{\n  \"access_token\": \"at_7Qm2vX9kLp4RzT8wN3bY\",\n  \"token_type\": \"Bearer\",\n  \"expires_in\": 3600,\n  \"expires_at\": \"2026-10-01T11:00:00.000Z\",\n  \"issued_at\": \"2026-10-01T10:00:00.000Z\",\n  \"refresh_expires_in\": 2592000,\n  \"scope\": \"orders:read orders:write\"\n}",
    },
  ],
}
export default recipe
