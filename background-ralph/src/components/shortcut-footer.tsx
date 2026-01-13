type Props = {
  completedCount: number
  totalCount: number
  onHelp: () => void
}

export function ShortcutFooter({ completedCount, totalCount, onHelp }: Props) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 font-mono bg-white border border-slate-200 rounded text-[10px]">C</kbd>
          <span>Continue</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 font-mono bg-white border border-slate-200 rounded text-[10px]">S</kbd>
          <span>Stop</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 font-mono bg-white border border-slate-200 rounded text-[10px]">E</kbd>
          <span>Edit</span>
        </span>
        <button
          onClick={onHelp}
          className="flex items-center gap-1.5 hover:text-slate-700"
        >
          <kbd className="px-1.5 py-0.5 font-mono bg-white border border-slate-200 rounded text-[10px]">?</kbd>
          <span>Help</span>
        </button>
      </div>
      <div className="font-medium">
        {completedCount}/{totalCount} stories
      </div>
    </div>
  )
}
