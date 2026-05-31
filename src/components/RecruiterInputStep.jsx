import { apiFetch } from '../api.js'
import { useRef, useState } from 'react'

export default function RecruiterInputStep({ onBatch, onModeChange }) {
  const [jobInputMode, setJobInputMode] = useState('url')
  const [jobUrl, setJobUrl] = useState('')
  const [jobText, setJobText] = useState('')
  const [jobPasted, setJobPasted] = useState('')
  const [jobStatus, setJobStatus] = useState('idle')
  const [jobError, setJobError] = useState(null)
  const [jobTitle, setJobTitle] = useState('')
  const [jobCompany, setJobCompany] = useState('')
  const [candidates, setCandidates] = useState([])

  const fileInputRef = useRef(null)

  const jobDescription = jobInputMode === 'url' ? jobText : jobPasted
  const jobReady = jobInputMode === 'url' ? jobStatus === 'ready' : jobPasted.trim().length > 100
  const readyCandidates = candidates.filter(c => c.status === 'ready')
  const canSubmit = jobReady && readyCandidates.length > 0

  async function handleFetchJob() {
    if (!jobUrl.trim()) return
    setJobStatus('fetching')
    setJobError(null)
    try {
      const res = await apiFetch('/api/fetch-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jobUrl })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setJobText(data.text)
      const lines = data.text.split('\n').filter(Boolean)
      setJobTitle(lines[0] || 'Job')
      setJobCompany(lines[1] || '')
      setJobStatus('ready')
    } catch (err) {
      setJobError(err.message)
      setJobStatus('error')
    }
  }

  async function handleFilesChange(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return

    const newCandidates = files.map(f => ({
      id: `${Date.now()}-${Math.random()}`,
      filename: f.name,
      text: '',
      status: 'parsing',
      error: null,
      file: f,
    }))
    setCandidates(prev => [...prev, ...newCandidates])

    await Promise.all(newCandidates.map(async candidate => {
      const formData = new FormData()
      formData.append('file', candidate.file)
      try {
        const res = await apiFetch('/api/parse-resume', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Parse failed')
        setCandidates(prev => prev.map(c =>
          c.id === candidate.id ? { ...c, text: data.text, status: 'ready' } : c
        ))
      } catch (err) {
        setCandidates(prev => prev.map(c =>
          c.id === candidate.id ? { ...c, status: 'error', error: err.message } : c
        ))
      }
    }))

    e.target.value = ''
  }

  function removeCandidate(id) {
    setCandidates(prev => prev.filter(c => c.id !== id))
  }

  function handleSubmit() {
    if (!canSubmit) return
    onBatch({ jobDescription, candidates: readyCandidates })
  }

  return (
    <div>
      <div className="text-center mb-6 md:mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Offerlia</h1>
        <p className="text-gray-400 text-base md:text-lg mb-5">AI-powered candidate evaluation, built for recruiters.</p>
        <div className="inline-flex rounded-xl border border-gray-700 p-1 gap-1 bg-gray-900">
          <button
            type="button"
            onClick={() => onModeChange('applicant')}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-colors text-gray-400 hover:text-white"
          >
            For Applicants
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white shadow"
          >
            For Recruiters
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-violet-500/30 text-violet-300 font-normal">Beta</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">

        {/* Left header */}
        <div className="flex items-end justify-between order-1">
          <div>
            <span className="text-sm font-medium text-gray-300">Job Posting</span>
            <span className="text-xs text-gray-500 ml-2">Finn.no, LinkedIn, or any career page</span>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
            {[{ id: 'url', label: 'URL' }, { id: 'paste', label: 'Paste' }].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setJobInputMode(m.id)}
                className={`px-3 py-1.5 transition-colors ${jobInputMode === m.id ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right header */}
        <div className="flex flex-col justify-end order-3 md:order-2 mt-6 md:mt-0">
          <span className="text-sm font-medium text-gray-300">Candidate CVs</span>
          <span className="text-xs text-gray-500 mt-0.5">PDF or DOCX — upload as many as you need</span>
        </div>

        {/* Left body */}
        <div className="flex flex-col gap-2 order-2 md:order-3">
          {jobInputMode === 'url' ? (
            <>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={jobUrl}
                  onChange={e => { setJobUrl(e.target.value); setJobStatus('idle') }}
                  onKeyDown={e => e.key === 'Enter' && handleFetchJob()}
                  placeholder="https://www.finn.no/job/ad/123 or LinkedIn URL"
                  className="flex-1 px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-violet-500 text-sm"
                />
                <button
                  type="button"
                  onClick={handleFetchJob}
                  disabled={jobStatus === 'fetching' || !jobUrl.trim()}
                  className="px-4 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 disabled:opacity-40 border border-gray-700 whitespace-nowrap transition-colors"
                >
                  {jobStatus === 'fetching' ? 'Fetching...' : 'Fetch'}
                </button>
              </div>
              {jobStatus === 'ready' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-900/20 border border-green-800/40">
                  <span className="text-green-400 shrink-0">✓</span>
                  <span className="text-sm text-green-300 font-medium truncate">{jobTitle}</span>
                  {jobCompany && <span className="text-sm text-gray-500 shrink-0 truncate">{jobCompany}</span>}
                </div>
              )}
              {jobStatus === 'error' && <p className="text-xs text-red-400">{jobError}</p>}
              {jobStatus === 'idle' && <div className="min-h-40 md:min-h-60" />}
            </>
          ) : (
            <textarea
              value={jobPasted}
              onChange={e => setJobPasted(e.target.value)}
              placeholder="Paste the full job description here..."
              className="min-h-40 md:min-h-72 p-4 rounded-xl bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-violet-500 resize-none text-sm leading-relaxed"
            />
          )}
        </div>

        {/* Right body */}
        <div className="flex flex-col gap-2 order-4">
          <div className="min-h-40 md:min-h-72 flex flex-col rounded-xl bg-gray-900 border border-dashed border-gray-700 overflow-hidden">
            {candidates.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-300 mb-1">Drop candidate CVs here or</p>
                  <button type="button" onClick={() => fileInputRef.current.click()} className="text-sm text-violet-400 hover:text-violet-300 underline">
                    browse files
                  </button>
                </div>
                <p className="text-xs text-gray-600">PDF or DOCX — select multiple at once</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex-1 divide-y divide-gray-800 overflow-auto">
                  {candidates.map(c => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                      {c.status === 'parsing' && <span className="w-3.5 h-3.5 border-2 border-gray-600 border-t-violet-400 rounded-full animate-spin shrink-0" />}
                      {c.status === 'ready' && <span className="text-green-400 text-sm shrink-0">✓</span>}
                      {c.status === 'error' && <span className="text-red-400 text-sm shrink-0">✗</span>}
                      <span className="text-sm text-gray-300 flex-1 truncate">{c.filename}</span>
                      {c.status === 'error' && <span className="text-xs text-red-400 shrink-0 ml-1">{c.error}</span>}
                      <button onClick={() => removeCandidate(c.id)} className="text-gray-600 hover:text-red-400 text-xs ml-1 shrink-0 leading-none">✕</button>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-gray-800">
                  <button type="button" onClick={() => fileInputRef.current.click()} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                    + Add more files
                  </button>
                </div>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            multiple
            onChange={handleFilesChange}
            className="hidden"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-8 py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Evaluate {readyCandidates.length} {readyCandidates.length === 1 ? 'candidate' : 'candidates'} →
        </button>
      </div>

      <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { icon: '🎯', title: 'Fit Score', desc: 'Objective match against role requirements' },
          { icon: '🚩', title: 'Red Flags', desc: 'Gaps and areas to probe in interview' },
          { icon: '❓', title: 'Screening Questions', desc: '7 targeted questions per candidate' },
          { icon: '📋', title: 'ATS Note', desc: 'Ready-to-paste candidate summary' },
        ].map(f => (
          <div key={f.title} className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
            <div className="text-2xl mb-2">{f.icon}</div>
            <div className="text-sm font-medium text-white mb-1">{f.title}</div>
            <div className="text-xs text-gray-500">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
