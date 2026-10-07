// Generates the timestamp recipe's sample inputs (pretty-printed like browser devtools "copy response")
const s1 = {
  data: [
    { id: 48213, status: 'shipped', amount: 4999, currency: 'usd', created_at: 1759312800, shipped_at: 1759406522,
      customer: { name: 'Dana Whitfield', phone: '4155550123' } },
    { id: 48214, status: 'pending', amount: 1250, currency: 'usd', created_at: 1759320061, shipped_at: null,
      customer: { name: 'Luis Ortega', phone: '2025550147' } },
  ],
  has_more: true,
  next_cursor: 'b3JkZXI6NDgyMTQ',
}
const s2 = [
  { event: 'login', user_id: 1042, ip: '203.0.113.24', ts: 1759312800123 },
  { event: 'export_started', user_id: 1042, ip: '203.0.113.24', ts: 1759312865410 },
  { event: 'export_failed', user_id: 1042, ip: '203.0.113.24', ts: 1759312901007, error_code: 413, size_bytes: 1073741824 },
]
const s3 = {
  access_token: 'sk_test_51Example0000000000000000',
  token_type: 'Bearer',
  expires_in: 3600,
  expires_at: 1759316400,
  issued_at: '1759312800',
  refresh_expires_in: 2592000,
  scope: 'orders:read orders:write',
}
for (const s of [s1, s2, s3]) console.log(JSON.stringify(JSON.stringify(s, null, 2) + '\n'))
