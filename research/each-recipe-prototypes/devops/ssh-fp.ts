import { proto } from '../harness'
import { branch, each, laneStep } from '/home/user/string-utility-belt/src/recipes/define'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'

const TYPE = '(?:ssh-(?:ed25519|rsa|dss)|ecdsa-sha2-nistp(?:256|384|521)|sk-(?:ssh-ed25519|ecdsa-sha2-nistp256)@openssh\\.com)'
const KEY = `${TYPE}\\s+AAAA[A-Za-z0-9+/]+=*`

const swap = {
  ...branch('swap-key', [
    [laneStep('before', 'replace', { pattern: `^(.*?${TYPE}\\s+)AAAA[\\s\\S]*$`, replacement: '$1', regex: true, flags: '' }, { label: 'text before the key' })],
    [
      laneStep('blob', 'replace', { pattern: `^.*?${TYPE}\\s+(AAAA[A-Za-z0-9+/]+=*)[\\s\\S]*$`, replacement: '$1', regex: true, flags: '' }, { label: 'the Base64 key' }),
      laneStep('key-bytes', 'get_bytes', { mode: 'base64' }, { onError: 'stop' }),
      laneStep('sha256', 'hash', { algo: 'SHA-256' }),
      laneStep('digest-bytes', 'hex_decode', {}),
      laneStep('digest-b64', 'base64_encode', {}),
      laneStep('fingerprint', 'replace', { pattern: '^([A-Za-z0-9+/]*?)=*$', replacement: 'SHA256:$1', regex: true, flags: '' }, { label: 'SHA256: without padding' }),
    ],
    [laneStep('after', 'replace', { pattern: `^.*?${KEY}`, replacement: '', regex: true, flags: '' }, { label: 'text after the key' })],
  ], { mode: 'concat', separator: '' }, '', { condition: { kind: 'regex', pattern: `${KEY}` }, label: 'swap the key for its fingerprint' }),
}
delete (swap as any).why

export const recipe: Recipe = {
  slug: 'ssh-key-fingerprints',
  name: 'Get the fingerprint of every SSH key in a file',
  summary:
    'Paste an authorized_keys file, known_hosts or ssh-keyscan output and see every key as its SHA256 fingerprint, the form sshd logs and GitHub show, with options, hosts and comments kept.',
  category: 'DevOps & Config',
  primaryQuery: 'ssh public key fingerprint',
  published: '2026-10-08',
  steps: [
    each('per-line', { mode: 'lines' }, [swap as any],
      'Works through the file one line at a time. A line holding a public key has the long Base64 key replaced by its SHA256 fingerprint: the decoded key bytes hashed with SHA-256 and written in Base64 without padding, the SHA256: form ssh-keygen -l prints. Comments and blank lines pass through.',
      { label: 'fingerprint every key' }),
  ],
  samples: [
    { id: 'authorized-keys', title: 'authorized_keys with options', input: `# deploy@app-01.example.com:~/.ssh/authorized_keys
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGaPc7xK1xCItitCt06F4+cX6XAD+uOe1OZUYF4D3sUe alice@laptop.example.org
ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBCPRfh9n8NoTuZ06NHD1tlpChQoGnEeWR6Q4i8ERPsvgLJRA1tuMLjGtnyDyRjfls5ICVxUjddBIF7WqtlDShEU= bob@workstation.example.org
from="192.0.2.0/24",no-port-forwarding,no-agent-forwarding ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOCJMSWJHq9bzIaChBeRYis5fNyt7nBS3392kGn/WQT1 ci-deploy@ci.example.com
command="/usr/local/bin/rrsync -ro /srv/backups",restrict ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINCt5ySH2mpQg5BfYXM0scn0LV7Ff+CcXTAEn5DAP7d7 backup@203.0.113.10
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCBpBM7HWJVmJXnjX+om9nzJdbPzDJisait+fupecCZIlKyw/hpUf8IclI5GxQK567sujx8hR4aR96a+QQcI46l5XJh/D4Pj0bkM75xZ7G9ODceF1TEIWs6o67vIFPZ52hyO4B9HJDK4BTK3JsYXifk+WD4gLQHCcB1h45/1jY7cyt6/8eqkZU2bQe9R3WTorO59SOY/7l8roYaJBQc1GNmoiAFKfMAFY387W5Y/ocqpyuo/up+rZELV7BEey5MSPjvMEEvP31VbdSTkmPMeCGeG/BuAFuBuqxANyBjvrt+TBVJKqTrNUp8QXcSPBWXGcBlfWi690D76mUWJwn2fzTkqcYTPH4ORek2oYsd2lSm0DQfzkOoHZdS7rbAY2EoBfHPv4tQOKW79wICfceG7tAwmcTfoxZ9sZCNGm5t8E/0FUPU9Lf61qcxNjOzWWsHPcoHkZMA5XezWZ8QSUggCF4sageLqvFlT4oulzcaPTt2mkTKsqmyD4SoD0BHGftzVf8= carol@example.com
`, output: `# deploy@app-01.example.com:~/.ssh/authorized_keys
ssh-ed25519 SHA256:npfraH76ZzqHOTzZsZyjsEOgAQh9e/t3/EsFfxkH1o8 alice@laptop.example.org
ecdsa-sha2-nistp256 SHA256:XM7IR9XAZCwiLgerj3CjwxBSSf7f+ouWyFONHmjOt8o bob@workstation.example.org
from="192.0.2.0/24",no-port-forwarding,no-agent-forwarding ssh-ed25519 SHA256:+BVgmPJs2ZCRz/Qsl3CXXYlCylx0ISQzCko+T2t3x7Q ci-deploy@ci.example.com
command="/usr/local/bin/rrsync -ro /srv/backups",restrict ssh-ed25519 SHA256:KL0hx6N9xPqe4Zi+OcEw8nxDp3iphau/kJr/BXV977I backup@203.0.113.10
ssh-rsa SHA256:A0IT80YN162+1fml3jAcgcuXf+yHNIpxFkq6/wl1h58 carol@example.com
` },
    { id: 'keyscan', title: 'ssh-keyscan output for a Git host', input: `# git.example.com:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.5
git.example.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDgvHTbIlIUYNt6HdCeVEANq85zhZ0Dr45LdZYflPAxCOExF7I3rcvqdekhCzR2qZsHwD3c6A5Xg8vR45TYLZPGq7wD1CfSTLfgyLflabpb2Tx7ZToE/v4A0y4sTCHwxtC7mPIKMAfpLDa5EakH4khB03I+meT+q441HG5h0YhNQ4Mq3bWZgTMXKs3riFLb0356LK3bvoU32OGA7Mi47nxHU0Ew2izXJb7xvcBceteKrcY3MsATaGO9ypZz8FRTbvGimhNFynLAiSu0f3MK/X32fsg/A/m3yJhfqYmvhXWZKZyj/1kKQ68zC4+5/5/vPSqYGkuNy8aurkzxKb8AvBdx
# git.example.com:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.5
git.example.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBLYuWcDZXNhKBJI1hYZxUoPzFsuSzbe4lMDEDSYf0NVgDgBvWMcKh2qzxmeCBdB59HpKvSD04uyiuTtJ43mhC6w=
# git.example.com:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.5
git.example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFWY0pWm+hQDKqVMp/fanT/xoFye0jebvdncqO/SBeSA
`, output: `# git.example.com:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.5
git.example.com ssh-rsa SHA256:EnwMf34rvxFxc7j72E5p7x8RaN2iGv5f/TAswaKQOsE
# git.example.com:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.5
git.example.com ecdsa-sha2-nistp256 SHA256:7ZONa5LzTtKunkCFZkXTzLQe0Tr8D8cx2WwvbFjBmQs
# git.example.com:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.5
git.example.com ssh-ed25519 SHA256:7QdFtX92omS7rmcU1W0+uO8BOaUnRiJ69m81cpQi1Kw
` },
  ],
}
if (!process.env.NO_PROTO) await proto(recipe)
