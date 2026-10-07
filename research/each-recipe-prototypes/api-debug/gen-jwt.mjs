import { createHmac } from 'node:crypto'
const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')
const SECRET = 'example-signing-secret-not-real'
export const sign = (header, payload) => {
  const head = `${b64u(header)}.${b64u(payload)}`
  return `${head}.${createHmac('sha256', SECRET).update(head).digest('base64url')}`
}
const H = { alg: 'HS256', typ: 'JWT' }
const ISS = 'https://auth.example.com/'
const AUD = 'https://api.example.com'
export const A = sign(H, { iss: ISS, sub: 'user_1042', aud: AUD, scope: 'orders:read orders:write', iat: 1790848800, exp: 1790852400 })
export const B = sign(H, { iss: ISS, sub: 'svc-reporting', aud: AUD, scope: 'reports:read', iat: 1790849100, exp: 1790850000 })
export const C = sign(H, { iss: ISS, sub: 'user_2087', aud: AUD, scope: 'orders:read', iat: 1790841600, exp: 1790845200 })
// OIDC sign-in: id token (nested claims) + access token, as a HAR token-endpoint response
export const ID = sign({ alg: 'HS256', typ: 'JWT', kid: 'k-2026-09' }, { iss: ISS, sub: 'user_3311', aud: 'web-dashboard', email: 'mara.lindqvist@example.org', name: 'Mara Lindqvist', groups: ['support', 'billing-viewers'], auth_time: 1790935200, iat: 1790935201, exp: 1790938801, nonce: 'n-4b7e1d' })
export const AT = sign({ alg: 'HS256', typ: 'at+jwt', kid: 'k-2026-09' }, { iss: ISS, sub: 'user_3311', aud: AUD, client_id: 'web-dashboard', scope: 'openid profile tickets:read', iat: 1790935201, exp: 1790936101, jti: '9c1e7a52-3f0b-4d8e-a6c2-5b9d0e4f7a13' })
// an unsigned (alg none) token, as some dev/test setups emit
export const NONE = `${b64u({ alg: 'none', typ: 'JWT' })}.${b64u({ sub: 'test-user', role: 'admin', iat: 1791021600, exp: 1791025200 })}.`
if (process.argv[2] === 'print') for (const [k, v] of Object.entries({ A, B, C, ID, AT, NONE })) console.log(k, v.length, v)
