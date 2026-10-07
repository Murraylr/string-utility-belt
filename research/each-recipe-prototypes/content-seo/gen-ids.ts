// Seeded pseudo-random tracker ids, shaped like the real ones (prefixes as the platforms use them). Synthetic.
let seed = 20261008
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
const pick = (alpha: string, n: number) => Array.from({ length: n }, () => alpha[Math.floor(rnd() * alpha.length)]).join('')
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
const HEX = '0123456789abcdef'
console.log('fbclid', 'IwZXh0bgNhZW0CMTEAAR' + pick(B64, 40))
console.log('gclid', 'Cj0KCQjw' + pick(B64, 60) + '_BwE')
console.log('gbraid', '0AAAAADm' + pick(B64, 24))
console.log('srsltid', 'AfmBOo' + pick(B64, 44))
console.log('msclkid', pick(HEX, 32))
console.log('_hsenc', 'p2ANqtz-' + pick(B64, 60))
console.log('mc_cid', pick(HEX, 10), 'mc_eid', pick(HEX, 10))
console.log('li_fat_id', [8, 4, 4, 4, 12].map(n => pick(HEX, n)).join('-'))
console.log('mkt_tok', 'NzQ3LUZXUC0yMDQAAAG' + pick(B64, 40))
console.log('ttclid', 'E.C.P.' + pick(B64, 40))
console.log('igsh', pick('abcdefghijklmnopqrstuvwxyz0123456789', 16))
