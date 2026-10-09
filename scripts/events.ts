/**
 * Prints the events the site counted (POST /api/event → Workers Analytics Engine):
 *
 *   npm run events                        the last 30 days
 *   npm run events -- --days 7            the last 7 days (up to 92, what Cloudflare keeps)
 *   npm run events -- --month 2026-11     one calendar month, UTC — a sponsor's monthly report
 *
 * Needs CLOUDFLARE_ACCOUNT_ID and a CLOUDFLARE_API_TOKEN with "Account Analytics: Read".
 */
import { buildQuery, formatReport, parsePeriod, parseRows } from './events/report'

async function main() {
  const period = parsePeriod(process.argv.slice(2), new Date())
  const account = process.env.CLOUDFLARE_ACCOUNT_ID
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!account || !token) {
    throw new Error('set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (a token with "Account Analytics: Read")')
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/analytics_engine/sql`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: buildQuery(period),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`the SQL API answered ${res.status}: ${text.slice(0, 500)}`)
  console.log(formatReport(parseRows(JSON.parse(text)), period))
}

main().catch(e => {
  console.error(`[events] ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
