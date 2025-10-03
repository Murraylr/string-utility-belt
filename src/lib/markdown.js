export function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function mdToHtml(md = '') {
  // code fences ```
  md = md.replace(/```([\s\S]*?)```/g, (_, code) => {
    return `<pre class="whitespace-pre overflow-x-auto p-3 rounded-lg bg-black/40 border border-white/10"><code>${escapeHtml(code.trim())}</code></pre>`;
  });
  // headings
  md = md.replace(/^###\s+(.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>');
  md = md.replace(/^##\s+(.+)$/gm, '<h2 class="text-xl font-bold mt-8 mb-3">$1</h2>');
  md = md.replace(/^#\s+(.+)$/gm, '<h1 class="text-2xl font-bold mt-10 mb-4">$1</h1>');
  // inline code
  md = md.replace(/`([^`]+)`/g, (_, code) => `<code class="px-1.5 py-0.5 rounded bg-white/10 border border-white/10">${escapeHtml(code)}</code>`);
  // bold/italic (lightweight)
  md = md.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  md = md.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // paragraphs
  md = md.split(/\n{2,}/).map(p => `<p class="mb-4 leading-7">${p}</p>`).join('\n');
  return md;
}
