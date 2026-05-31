import { apiFetch } from '../api.js'
import { useRef, useState, useEffect } from 'react'

const TONES = [
  { id: 'professional', label: 'Professional' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'enthusiastic', label: 'Enthusiastic' },
]

export default function InputStep({ onBatch, error, resumes, activeResumeId, onSelectResume, onAddResume, onDeleteResume, onRenameResume }) {
  // Job URLs
  const [batchUrls, setBatchUrls] = useState('')
  const [batchJobs, setBatchJobs] = useState([])
  const [fetchingBatch, setFetchingBatch] = useState(false)

  // Resume (shared)
  const activeResume = resumes.find(r => r.id === activeResumeId) || null
  const [resume, setResume] = useState(activeResume?.text || '')
  const [resumeTab, setResumeTab] = useState('paste')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [linkedinRaw, setLinkedinRaw] = useState('')
  const [linkedinLoading, setLinkedinLoading] = useState(false)
  const [linkedinError, setLinkedinError] = useState(null)
  const [editingResumeId, setEditingResumeId] = useState(null)
  const [editingName, setEditingName] = useState('')

  // Tone & mode
  const [tone, setTone] = useState('professional')
  const [mode, setMode] = useState('applicant')

  const fileInputRef = useRef(null)

  useEffect(() => {
    const ar = resumes.find(r => r.id === activeResumeId)
    if (ar) setResume(ar.text || '')
  }, [activeResumeId])

  // Fetch job details from URLs
  async function handleFetchBatch() {
    const urls = batchUrls.split('\n').map(u => u.trim()).filter(Boolean)
    if (!urls.length) return
    setFetchingBatch(true)
    const jobs = urls.map(url => ({ url, title: url, description: null, status: 'fetching' }))
    setBatchJobs([...jobs])

    for (let i = 0; i < urls.length; i++) {
      try {
        const res = await apiFetch('/api/fetch-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urls[i] })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        jobs[i] = { url: urls[i], title: urls[i], description: data.text, status: 'ready' }
      } catch (err) {
        jobs[i] = { url: urls[i], title: urls[i], description: null, status: 'error', error: err.message }
      }
      setBatchJobs([...jobs])
    }
    setFetchingBatch(false)
  }

  function handleSubmit() {
    const ready = batchJobs.filter(j => j.status === 'ready')
    if (!ready.length || !resume.trim()) return
    onBatch({ jobs: ready, resume, tone, resumeId: activeResumeId, mode })
  }

  // File upload
  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    setFileName(file.name)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await apiFetch('/api/parse-resume', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setResume(data.text)
      setResumeTab('paste')
    } catch (err) {
      setUploadError(err.message)
      setFileName(null)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // LinkedIn cleanup
  async function handleLinkedInClean() {
    if (!linkedinRaw.trim()) return
    setLinkedinLoading(true)
    setLinkedinError(null)
    try {
      const res = await apiFetch('/api/clean-linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: linkedinRaw })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to process')
      setResume(data.text)
      setResumeTab('paste')
    } catch (err) {
      setLinkedinError(err.message)
    } finally {
      setLinkedinLoading(false)
    }
  }

  const readyCount = batchJobs.filter(j => j.status === 'ready').length
  const canSubmit = readyCount > 0 && resume.trim().length > 50

  return (
    <div>
      <div className="text-center mb-6 md:mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Offerlia</h1>
        <p className="text-gray-400 text-base md:text-lg mb-5">
          {mode === 'recruiter' ? 'AI-powered candidate evaluation, built for recruiters.' : 'AI-powered job applications, tailored to you.'}
        </p>
        <div className="inline-flex rounded-xl border border-gray-700 p-1 gap-1 bg-gray-900">
          <button
            type="button"
            onClick={() => setMode('applicant')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'applicant' ? 'bg-violet-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
          >
            For Applicants
          </button>
          <button
            type="button"
            onClick={() => setMode('recruiter')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'recruiter' ? 'bg-violet-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
          >
            For Recruiters
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-violet-500/30 text-violet-300 font-normal">Beta</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-900/40 border border-red-700 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">

        {/* ── Left header ── */}
        <div className="flex flex-col justify-end order-1">
          <span className="text-sm font-medium text-gray-300">Job URLs</span>
          <span className="text-xs text-gray-500 mt-0.5">One per line — Finn.no, LinkedIn, or any career page</span>
        </div>

        {/* ── Right header ── */}
        <div className="flex flex-col gap-2 order-3 md:order-2 mt-6 md:mt-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-300 shrink-0">{mode === 'recruiter' ? 'Candidate CV:' : 'Resume:'}</span>
            {resumes.map(r => (
              <div key={r.id} className="flex items-center gap-0.5">
                {editingResumeId === r.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onBlur={() => { onRenameResume(r.id, editingName || r.name); setEditingResumeId(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') { onRenameResume(r.id, editingName || r.name); setEditingResumeId(null) } }}
                    className="text-xs px-2 py-1 rounded-lg bg-gray-700 border border-violet-500 text-white focus:outline-none w-24"
                  />
                ) : (
                  <button
                    onClick={() => onSelectResume(r.id)}
                    onDoubleClick={() => { setEditingResumeId(r.id); setEditingName(r.name) }}
                    title="Double-click to rename"
                    className={`text-xs px-3 py-1 rounded-lg border transition-colors ${activeResumeId === r.id ? 'bg-violet-600 border-violet-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
                  >
                    {r.name}
                  </button>
                )}
                {resumes.length > 1 && activeResumeId === r.id && editingResumeId !== r.id && (
                  <button onClick={() => onDeleteResume(r.id)} className="text-gray-600 hover:text-red-400 text-xs ml-0.5 leading-none">✕</button>
                )}
              </div>
            ))}
            <button onClick={onAddResume} className="text-xs px-2 py-1 rounded-lg border border-dashed border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors">+ New</button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-600 hidden sm:block">Double-click to rename. Saves on submit.</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs ml-auto">
              {[{ id: 'paste', label: 'Paste' }, { id: 'upload', label: 'Upload' }, { id: 'linkedin', label: 'LinkedIn' }].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setResumeTab(tab.id); setUploadError(null); setLinkedinError(null) }}
                  className={`px-3 py-1.5 transition-colors ${resumeTab === tab.id ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Left body ── */}
        <div className="flex flex-col gap-2 order-2 md:order-3">
          <textarea
            value={batchUrls}
            onChange={e => setBatchUrls(e.target.value)}
            placeholder={"https://www.finn.no/job/ad/123\nhttps://www.finn.no/job/ad/456\nhttps://www.linkedin.com/jobs/view/789"}
            className="min-h-40 md:min-h-72 p-4 rounded-xl bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-violet-500 resize-none text-sm font-mono leading-relaxed"
          />
          <button
            type="button"
            onClick={handleFetchBatch}
            disabled={fetchingBatch || !batchUrls.trim()}
            className="py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-700"
          >
            {fetchingBatch ? 'Fetching job details...' : 'Fetch job details'}
          </button>

          {batchJobs.length > 0 && (
            <div className="space-y-2 mt-1">
              {batchJobs.map((job, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg text-xs border ${
                  job.status === 'ready' ? 'bg-green-900/20 border-green-800/40 text-green-300' :
                  job.status === 'error' ? 'bg-red-900/20 border-red-800/40 text-red-300' :
                  'bg-gray-800/60 border-gray-700 text-gray-400'
                }`}>
                  {job.status === 'fetching' && <span className="w-3 h-3 border-2 border-gray-500 border-t-violet-400 rounded-full animate-spin shrink-0" />}
                  {job.status === 'ready' && <span className="shrink-0">✓</span>}
                  {job.status === 'error' && <span className="shrink-0">✗</span>}
                  <span className="truncate">{job.url}</span>
                  {job.status === 'error' && <span className="ml-auto text-red-400 shrink-0">{job.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right body ── */}
        <div className="flex flex-col gap-2 order-4">
          {resumeTab === 'paste' && (
            <textarea
              value={resume}
              onChange={e => setResume(e.target.value)}
              placeholder={"Jane Smith\njane@example.com\n\nEXPERIENCE\nSenior Developer at XYZ Corp (2021–present)\n- Built scalable APIs serving 2M+ users\n..."}
              className="flex-1 min-h-72 p-4 rounded-xl bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-violet-500 resize-none text-sm leading-relaxed"
            />
          )}

          {resumeTab === 'upload' && (
            <div className="flex-1 min-h-72 flex flex-col items-center justify-center gap-4 rounded-xl bg-gray-900 border border-dashed border-gray-700 p-8">
              <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-300 mb-1">Drop your resume here or</p>
                <button type="button" onClick={() => fileInputRef.current.click()} disabled={uploading} className="text-sm text-violet-400 hover:text-violet-300 underline disabled:opacity-50">
                  {uploading ? 'Parsing...' : 'browse files'}
                </button>
              </div>
              <p className="text-xs text-gray-600">PDF or DOCX, up to 5MB</p>
              {fileName && !uploading && <p className="text-xs text-green-400">✓ {fileName} loaded</p>}
              {uploadError && <p className="text-xs text-red-400 text-center">{uploadError}</p>}
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileChange} className="hidden" />
            </div>
          )}

          {resumeTab === 'linkedin' && (
            <div className="flex-1 min-h-72 flex flex-col gap-3 rounded-xl bg-gray-900 border border-gray-700 p-5">

              {/* Step-by-step instructions */}
              <div className="space-y-2">
                {[
                  { n: '1', text: 'Open your LinkedIn profile in your browser' },
                  { n: '2', text: <>Press <kbd className="px-1.5 py-0.5 rounded bg-gray-700 font-mono text-white">Cmd+A</kbd> to select everything on the page</> },
                  { n: '3', text: <>Press <kbd className="px-1.5 py-0.5 rounded bg-gray-700 font-mono text-white">Cmd+C</kbd> to copy</> },
                  { n: '4', text: 'Come back here and paste below' },
                ].map(s => (
                  <div key={s.n} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">{s.n}</span>
                    <span className="text-sm text-gray-300">{s.text}</span>
                  </div>
                ))}
              </div>

              <textarea
                value={linkedinRaw}
                onChange={e => setLinkedinRaw(e.target.value)}
                placeholder="Paste here (Cmd+V) — this should be hundreds of lines of text, not a URL"
                className={`flex-1 min-h-28 p-3 rounded-lg bg-gray-800 border text-gray-100 placeholder-gray-600 focus:outline-none resize-none text-sm leading-relaxed ${
                  linkedinRaw.trim().startsWith('http')
                    ? 'border-yellow-600 focus:border-yellow-500'
                    : 'border-gray-700 focus:border-violet-500'
                }`}
              />

              {/* Warn if they pasted a URL instead of page content */}
              {linkedinRaw.trim().startsWith('http') && (
                <div className="p-3 rounded-lg bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 text-xs leading-relaxed">
                  <p className="font-semibold mb-1">That looks like a URL, not your profile content.</p>
                  <p>Go to your LinkedIn profile page, press <kbd className="px-1 py-0.5 rounded bg-yellow-900/50 font-mono">Cmd+A</kbd> then <kbd className="px-1 py-0.5 rounded bg-yellow-900/50 font-mono">Cmd+C</kbd>, then come back and paste here. You should see hundreds of lines of text.</p>
                </div>
              )}

              {linkedinError && <p className="text-xs text-red-400">{linkedinError}</p>}

              <button
                type="button"
                onClick={handleLinkedInClean}
                disabled={linkedinLoading || !linkedinRaw.trim() || linkedinRaw.trim().startsWith('http')}
                className="py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-violet-600 text-white hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                {linkedinLoading ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Offerlia is cleaning up your profile...</>
                ) : linkedinRaw.trim() && !linkedinRaw.trim().startsWith('http') ? 'Clean up and import' : 'Paste your profile text above'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tone + Submit */}
      <div className="mt-6 flex flex-col items-center gap-4">
        {mode === 'applicant' && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Tone:</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
              {TONES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTone(t.id)}
                  className={`px-4 py-1.5 transition-colors ${tone === t.id ? 'bg-violet-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-8 py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {mode === 'recruiter'
            ? `Evaluate ${readyCount} ${readyCount === 1 ? 'candidate' : 'candidates'} →`
            : `Analyze ${readyCount} ${readyCount === 1 ? 'job' : 'jobs'} →`}
        </button>
      </div>

      <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {(mode === 'recruiter' ? [
          { icon: '🎯', title: 'Fit Score', desc: 'Objective match against role requirements' },
          { icon: '🚩', title: 'Red Flags', desc: 'Gaps and areas to probe in interview' },
          { icon: '❓', title: 'Screening Questions', desc: '7 targeted questions for this candidate' },
          { icon: '📋', title: 'ATS Note', desc: 'Ready-to-paste candidate summary' },
        ] : [
          { icon: '🎯', title: 'Match Score', desc: 'See how well you fit the role' },
          { icon: '✍️', title: 'Tailored Bullets', desc: '5 resume bullets for this exact job' },
          { icon: '📝', title: 'Cover Letter', desc: 'Ready to send, your tone' },
          { icon: '🎤', title: 'Interview Prep', desc: '7 likely questions for this role' },
        ]).map(f => (
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
