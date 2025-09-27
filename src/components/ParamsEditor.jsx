import Select from './Select'
export default function ParamsEditor({spec,params,onChange}){
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {Object.entries(spec).map(([k,cfg]) => {
        const val = params[k] ?? (Object.prototype.hasOwnProperty.call(cfg,'default') ? cfg.default : (cfg.kind==='number'?0 : cfg.kind==='boolean'?false : ''))
        const set = v => onChange({...params, [k]: v})
        return (
          <label key={k} className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600">{cfg.label}</span>
            {cfg.kind==='string' && (
              <input className="border rounded-xl px-3 py-2 bg-white shadow-soft" placeholder={cfg.placeholder} value={val} onChange={e=>set(e.target.value)} />
            )}
            {cfg.kind==='number' && (
              <input type="number" className="border rounded-xl px-3 py-2 bg-white shadow-soft" value={val} onChange={e=>set(e.target.value===''?'':Number(e.target.value))} />
            )}
            {cfg.kind==='boolean' && (
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={!!val} onChange={e=>set(e.target.checked)} />
                <span>{String(val)}</span>
              </div>
            )}
            {cfg.kind==='select' && (
              <Select value={val} onChange={set} options={cfg.options||[]} />
            )}
          </label>
        )
      })}
    </div>
  )
}
