export default function ToolbarButton({icon:Icon,label,onClick,disabled}){
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border hover:bg-gray-50 disabled:opacity-50 shadow-soft"
    >
      <Icon size={16}/>
      <span className="text-sm">{label}</span>
    </button>
  )
}
