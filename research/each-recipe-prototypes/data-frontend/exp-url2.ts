import { run } from '../harness'
const input = 'https://www.example.com/blog/spring-sale?utm_source=newsletter\nhttp://Shop.Example.org:8080/cart\nexample.net/about-us\nhttps://cdn.example.com/assets/app.js\nhttps://partner@api.example.com/v2/orders\nhttps://docs.example.com/guide/index.html\n'
const r = await run(input, [{ id: 'x', utilityId: 'extract_preset', enabled: true, params: { type: ['domains'] } } as any])
console.log(JSON.stringify(r.out))
const r2 = await run(input, [{ id: 'x', utilityId: 'sed', enabled: true, params: { script: 's#^\\s*([a-z][a-z0-9+.-]*:)?//##I\ns#[/?#:].*$##', perLine: true } } as any])
console.log(JSON.stringify(r2.out), r2.errors)
