
# String Pipeline Workshop Pro

Production-grade React app for chaining string utilities, with per-step previews, local storage, colocated tests, MD5, and a custom function utility.

## Quickstart
```bash
npm i
npm run dev
```
open http://localhost:5173

## Tests
```bash
npm test
```

## Add a utility
Create `src/utilities/core/reverse.js`:
```js
export default { id:'reverse', name:'reverse', description:'reverse characters', params:{}, apply:(input)=> input.split('').reverse().join('') }
```
Then export it from `src/utilities/index.js`.
