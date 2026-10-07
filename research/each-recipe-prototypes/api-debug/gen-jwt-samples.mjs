import { A, B, C, ID, AT, NONE } from './gen-jwt.mjs'
const log = `2026-10-01T10:00:02Z INFO api req=7f3a2c GET /v1/orders 200 ip=203.0.113.24 auth="Bearer ${A}"
2026-10-01T10:05:00Z INFO api req=7f3a31 GET /v1/reports/daily 200 ip=198.51.100.7 auth="Bearer ${B}"
2026-10-01T10:05:12Z INFO api req=7f3a35 POST /v1/orders 201 ip=203.0.113.24 auth="Bearer ${A}"
2026-10-01T10:06:40Z WARN api req=7f3a3b GET /v1/orders/48214 401 ip=192.0.2.55 auth="Bearer ${C}" err="token expired"
`
const har = {
  log: {
    version: '1.2',
    creator: { name: 'WebInspector', version: '537.36' },
    entries: [
      {
        startedDateTime: '2026-10-02T10:00:00.912Z',
        request: {
          method: 'POST', url: 'https://auth.example.com/oauth/token', httpVersion: 'HTTP/2',
          headers: [{ name: 'content-type', value: 'application/x-www-form-urlencoded' }],
          postData: { mimeType: 'application/x-www-form-urlencoded', text: 'grant_type=authorization_code&code=SplxlOBeZQQYbYS6WxSbIA&client_id=web-dashboard' },
        },
        response: {
          status: 200, statusText: '',
          content: { mimeType: 'application/json', text: JSON.stringify({ access_token: AT, id_token: ID, token_type: 'Bearer', expires_in: 900 }) },
        },
      },
      {
        startedDateTime: '2026-10-02T10:00:02.087Z',
        request: {
          method: 'GET', url: 'https://api.example.com/v1/tickets?status=open', httpVersion: 'HTTP/2',
          headers: [{ name: 'authorization', value: `Bearer ${AT}` }, { name: 'accept', value: 'application/json' }],
        },
        response: { status: 200, statusText: '', content: { mimeType: 'application/json', text: '{"tickets":[]}' } },
      },
    ],
  },
}
const curl = `*   Trying 192.0.2.10:8443...
* Connected to dev-api.example.com (192.0.2.10) port 8443
> GET /v1/admin/users HTTP/1.1
> Host: dev-api.example.com:8443
> User-Agent: curl/8.5.0
> Accept: */*
> Authorization: Bearer ${NONE}
>
< HTTP/1.1 403 Forbidden
< content-type: application/json
< www-authenticate: Bearer error="invalid_token", error_description="unsigned tokens are not accepted"
<
{"error":"invalid_token"}
`
for (const s of [log, JSON.stringify(har, null, 2) + '\n', curl]) console.log(JSON.stringify(s))
