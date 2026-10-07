import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'

export const recipe: Recipe = {
  slug: 'cidr-list-to-ip-ranges',
  name: 'Convert a CIDR list to start and end IP ranges',
  summary:
    'Paste CIDR blocks, one per line, and get a CSV with the first and last address of every block, for firewalls and allowlists that ask for a start and end IP instead of a prefix.',
  category: 'DevOps & Config',
  primaryQuery: 'convert cidr list to ip ranges',
  published: '2026-10-08',
  steps: [
    each('info-each', { mode: 'lines' }, [laneStep('info', 'cidr', { mode: 'info' }, { condition: { kind: 'regex', pattern: '^\\s*[0-9A-Fa-f:.]+(/\\d{1,3})?\\s*$' } })],
      'The CIDR calculator reads one block at a time. Running it on each line that looks like an address works out every block on its own, network and last address included, for IPv4 and IPv6 alike.',
      { label: 'work out every block' }),
    step('collect', 'jsonl_to_json', { indent: 2, skipBlank: true, onError: 'skip' },
      'The results arrive as one JSON object per line. This collects them into a single JSON array, the shape the CSV step expects, dropping blank lines and comment lines that were never parsed.',
      { label: 'collect into an array' }),
    step('csv', 'json_to_csv', { delimiter: ',', header: true, flatten: false, eol: 'lf', columns: 'network,broadcast,totalHosts' },
      'Keeps the first address, the last address and the address count of each block as CSV columns, ready to paste into a firewall form or a spreadsheet.',
      { label: 'start and end as CSV' }),
  ],
  samples: [
    { id: 'allowlist', title: 'Partner allowlist', input: '192.0.2.0/24\n198.51.100.128/25\n203.0.113.64/27\n203.0.113.7/32\n2001:db8:4400::/40\n', output: 'network,broadcast,totalHosts\n192.0.2.0,192.0.2.255,256\n198.51.100.128,198.51.100.255,128\n203.0.113.64,203.0.113.95,32\n203.0.113.7,203.0.113.7,1\n2001:db8:4400::,2001:db8:44ff:ffff:ffff:ffff:ffff:ffff,309485009821345068724781056' },
    { id: 'messy', title: 'Comments and host bits', input: '# office egress\r\n198.51.100.37/29\r\n\r\n# vpn gateways\r\n203.0.113.200/30\r\n192.0.2.10\r\n', output: 'network,broadcast,totalHosts\n198.51.100.32,198.51.100.39,8\n203.0.113.200,203.0.113.203,4\n192.0.2.10,192.0.2.10,1' },
  ],
}
