const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function mdToHtml(md){
  let out = ''
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  let inCode = false, lang = ''
  for (let i=0;i<lines.length;i++){
    const line = lines[i]
    const fence = line.match(/^```(.*)$/)
    if (fence) {
      if (!inCode) { inCode = true; lang = (fence[1]||'').trim(); out += `<pre><code class="language-${lang}">` }
      else { inCode = false; out += `</code></pre>` }
      continue
    }
    if (inCode) { out += escapeHtml(line) + '\n'; continue }
    if (/^\s*$/.test(line)) { out += '\n'; continue }
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) { out += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>\n`; continue }
    const ul = line.match(/^\s*[-*]\s+(.*)$/)
    if (ul) {
      const items = [ul[1]]
      while (i+1<lines.length && /^\s*[-*]\s+/.test(lines[i+1])) items.push(lines[++i].replace(/^\s*[-*]\s+/,''))
      out += '<ul>' + items.map(it=>`<li>${inline(it)}</li>`).join('') + '</ul>\n'
      continue
    }
    out += `<p>${inline(line)}</p>\n`
  }
  return out
}
function inline(s){
  s = s.replace(/`([^`]+)`/g, (_,c)=>`<code>${c.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}</code>`)
  s = s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
  s = s.replace(/\*([^*]+)\*/g,'<em>$1</em>')
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
  return s
}
