import { useState } from 'react'

const STATUSES = [
  { id: null, label: 'Not applied', color: 'text-gray-500', bg: 'bg-gray-800' },
  { id: 'applied', label: 'Applied', color: 'text-blue-300', bg: 'bg-blue-900/40' },
  { id: 'screening', label: 'Screening', color: 'text-violet-300', bg: 'bg-violet-900/40' },
  { id: 'interview', label: 'Interview', color: 'text-yellow-300', bg: 'bg-yellow-900/40' },
  { id: 'offer', label: 'Offer', color: 'text-green-300', bg: 'bg-green-900/40' },
  { id: 'rejected', label: 'Rejected', color: 'text-red-400', bg: 'bg-red-900/20' },
]

function statusInfo(id) {
  return STATUSES.find(s => s.id === id) || STATUSES[0]
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ScoreChip({ score }) {
  if (!score) return null
  const color = score >= 75 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'
  return <span className={`text-sm font-bold shrink-0 ${color}`}>{score}</span>
}

function StatusPicker({ current, onChange }) {
  const [open, setOpen] = useState(false)
  const info = statusInfo(current)
  return (
    <div className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className={`text-xs px-2 py-0.5 rounded-full ${info.bg} ${info.color} border border-white/10`}
      >
        {info.label}
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-20 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden min-w-36">
          {STATUSES.map(s => (
            <button
              key={String(s.id)}
              onClick={e => { e.stopPropagation(); onChange(s.id); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors ${s.color} ${current === s.id ? 'font-semibold' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HistoryPanel({ history, onClose, onLoad, onClear, onStatusChange }) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const filtered = history.filter(e => {
    const matchesSearch =
      (e.jobTitle || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.company || '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = filterStatus === 'all' || e.status === (filterStatus === 'none' ? null : filterStatus)
    return matchesSearch && matchesStatus
  })

  const stats = {
    applied: history.filter(e => e.status === 'applied').length,
    interview: history.filter(e => e.status === 'interview').length,
    offer: history.filter(e => e.status === 'offer').length,
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-gray-900 border-l border-gray-800 flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Application History</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-3 px-5 py-3 border-b border-gray-800">
          {[
            { label: 'Applied', value: stats.applied, color: 'text-blue-300' },
            { label: 'Interviews', value: stats.interview, color: 'text-yellow-300' },
            { label: 'Offers', value: stats.offer, color: 'text-green-300' },
          ].map(s => (
            <div key={s.label} className="flex-1 text-center p-2 rounded-lg bg-gray-800/50">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="px-4 py-3 border-b border-gray-800 space-y-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by job or company..."
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-600 text-sm focus:outline-none focus:border-violet-500"
          />
          <div className="flex gap-1.5 flex-wrap">
            {[{ id: 'all', label: 'All' }, { id: 'applied', label: 'Applied' }, { id: 'interview', label: 'Interview' }, { id: 'offer', label: 'Offer' }, { id: 'rejected', label: 'Rejected' }, { id: 'none', label: 'Not applied' }].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterStatus(f.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filterStatus === f.id ? 'bg-violet-600 border-violet-600 text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-600 text-sm mt-10">No applications found</p>
          ) : (
            filtered.map(entry => (
              <div
                key={entry.id}
                className="px-5 py-3 hover:bg-gray-800/40 transition-colors border-b border-gray-800/50 last:border-0 cursor-pointer"
                onClick={() => onLoad(entry)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{entry.jobTitle || 'Untitled job'}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{entry.company || 'Unknown company'}</p>
                    <p className="text-xs text-gray-600 mt-1">{formatDate(entry.date)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <ScoreChip score={entry.matchScore} />
                    <StatusPicker
                      current={entry.status}
                      onChange={status => onStatusChange(entry.id, status)}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-800">
          <button onClick={onClear} className="w-full py-2 text-xs text-gray-600 hover:text-red-400 transition-colors">
            Clear all history
          </button>
        </div>
      </div>
    </div>
  )
}
