import { apiFetch } from '../api.js'
import { useState, useEffect } from 'react'
import JSZip from 'jszip'

const LOADING_MESSAGES = [
  'Reading the job description...',
  'Reviewing your resume...',
  'Calculating your match score...',
  'Crafting tailored resume bullets...',
  'Writing your cover letter...',
  'Preparing interview questions...',
  'Almost there...',
]

const FUN_MESSAGES = [
  'Brewing the perfect application...',
  'Reading between the lines...',
  'Matching your superpowers to the role...',
  'Polishing your professional story...',
  'Crafting words that open doors...',
  'Making recruiters stop scrolling...',
  'Turning experience into opportunity...',
  'Almost ready to impress...',
]

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function copy() { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return <button onClick={copy} className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-white transition-colors">{copied ? '✓' : 'Copy'}</button>
}

async function fetchDocxBuffer(result) {
  const res = await apiFetch('/api/export-docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result)
  })
  if (!res.ok) throw new Error('Export failed')
  return res.arrayBuffer()
}

function LoadingCard() {
  const [msgIndex, setMsgIndex] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length), 3000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 flex items-center gap-3">
      <span className="w-4 h-4 border-2 border-gray-600 border-t-violet-400 rounded-full animate-spin shrink-0" />
      <span className="text-sm text-gray-400 transition-all">{LOADING_MESSAGES[msgIndex]}</span>
    </div>
  )
}

function ErrorCard({ result }) {
  return (
    <div className="rounded-xl bg-gray-900 border border-red-800/40 p-4 flex items-center gap-3">
      <span className="text-red-400 text-sm shrink-0">✗</span>
      <span className="text-sm text-gray-300 flex-1 truncate">{result.jobTitle}</span>
      <span className="text-xs text-red-400 shrink-0">{result.error}</span>
    </div>
  )
}

function JobCard({ result }) {
  const [expanded, setExpanded] = useState(false)
  const [downloading, setDownloading] = useState(false)

  if (result.status === 'error') return <ErrorCard result={result} />
  if (!result.matchScore) return <LoadingCard />

  const scoreColor = result.matchScore >= 75 ? 'text-green-400' : result.matchScore >= 50 ? 'text-yellow-400' : 'text-red-400'
  const scoreBg = result.matchScore >= 75 ? 'bg-green-900/20 border-green-800/40' : result.matchScore >= 50 ? 'bg-yellow-900/20 border-yellow-800/40' : 'bg-red-900/20 border-red-800/40'

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <div className={`px-2.5 py-1 rounded-lg border text-sm font-bold ${scoreColor} ${scoreBg}`}>{result.matchScore}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{result.jobTitle}</p>
          {result.company && <p className="text-xs text-gray-500 truncate">{result.company}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={async () => {
              setDownloading(true)
              try {
                const buf = await fetchDocxBuffer(result)
                const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `cover-letter-${(result.company || 'application').toLowerCase().replace(/\s+/g, '-')}.docx`
                a.click()
                URL.revokeObjectURL(url)
              } catch {}
              setDownloading(false)
            }}
            disabled={downloading}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors border border-gray-700 disabled:opacity-40"
          >
            {downloading ? '...' : '↓ .docx'}
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors border border-gray-700"
          >
            {expanded ? 'Hide' : 'View'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-800 p-5 space-y-5">
          <p className="text-sm text-gray-400 italic">{result.matchSummary}</p>
          {result.salaryEstimate && <p className="text-sm text-gray-400">Estimated salary: <span className="text-white font-medium">{result.salaryEstimate}</span></p>}

          {result.gapAnalysis?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Gaps</h3>
              <ul className="space-y-1.5">
                {result.gapAnalysis.map((g, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-300"><span className="text-yellow-500 shrink-0">⚠</span>{g}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Resume Bullets</h3>
              <CopyButton text={result.tailoredBullets.join('\n')} />
            </div>
            <ul className="space-y-2">
              {result.tailoredBullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-300"><span className="text-violet-400 shrink-0">•</span>{b}</li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Cover Letter</h3>
              <CopyButton text={result.coverLetter} />
            </div>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{result.coverLetter}</p>
          </div>

          {result.emailDraft && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Email Draft</h3>
                <CopyButton text={result.emailDraft} />
              </div>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{result.emailDraft}</p>
            </div>
          )}

          {result.linkedinMessage && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">LinkedIn Connection Request</h3>
                <CopyButton text={result.linkedinMessage} />
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{result.linkedinMessage}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const RECOMMENDATION_STYLES = {
  'Strong Yes': 'text-green-400 bg-green-900/20 border-green-800/40',
  'Yes': 'text-green-300 bg-green-900/10 border-green-800/30',
  'Maybe': 'text-yellow-400 bg-yellow-900/20 border-yellow-800/40',
  'Pass': 'text-red-400 bg-red-900/20 border-red-800/40',
}

function RecruiterCard({ result }) {
  const [expanded, setExpanded] = useState(false)

  if (result.status === 'error') return <ErrorCard result={result} />
  if (!result.fitScore) return <LoadingCard />

  const scoreColor = result.fitScore >= 75 ? 'text-green-400' : result.fitScore >= 50 ? 'text-yellow-400' : 'text-red-400'
  const scoreBg = result.fitScore >= 75 ? 'bg-green-900/20 border-green-800/40' : result.fitScore >= 50 ? 'bg-yellow-900/20 border-yellow-800/40' : 'bg-red-900/20 border-red-800/40'
  const recStyle = RECOMMENDATION_STYLES[result.recommendation] || 'text-gray-400 bg-gray-800 border-gray-700'

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <div className={`px-2.5 py-1 rounded-lg border text-sm font-bold ${scoreColor} ${scoreBg}`}>{result.fitScore}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{result.candidateName || result.candidateFile || 'Candidate'}</p>
          {result.jobTitle && <p className="text-xs text-gray-500 truncate">{result.jobTitle}{result.company ? ` — ${result.company}` : ''}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {result.recommendation && (
            <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${recStyle}`}>
              {result.recommendation}
            </span>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors border border-gray-700"
          >
            {expanded ? 'Hide' : 'View'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-800 p-5 space-y-5">
          <p className="text-sm text-gray-400 italic">{result.fitSummary}</p>

          <div className="flex items-center gap-3 flex-wrap">
            {result.seniorityAssessment && (
              <p className="text-sm text-gray-400">{result.seniorityAssessment}</p>
            )}
            {result.salaryBenchmark && (
              <p className="text-sm text-gray-400">Expected salary: <span className="text-white font-medium">{result.salaryBenchmark}</span></p>
            )}
          </div>

          {result.strengths?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Strengths</h3>
              <ul className="space-y-1.5">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-300"><span className="text-green-400 shrink-0">✓</span>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {result.redFlags?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Red Flags / Areas to Probe</h3>
              <ul className="space-y-1.5">
                {result.redFlags.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-300"><span className="text-red-400 shrink-0">⚑</span>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {result.screeningQuestions?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Screening Questions</h3>
              <ol className="space-y-2">
                {result.screeningQuestions.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-300"><span className="text-violet-400 shrink-0 font-medium">{i + 1}.</span>{q}</li>
                ))}
              </ol>
            </div>
          )}

          {result.atsNote && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">ATS Note</h3>
                <CopyButton text={result.atsNote} />
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{result.atsNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BatchResultsStep({ results, loadingLabel }) {
  const [zipping, setZipping] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [funIndex, setFunIndex] = useState(0)
  const score = r => r.matchScore || r.fitScore || 0
  const done = results.filter(r => r.status === 'done' && score(r)).length
  const total = results.length
  const allDone = !loadingLabel && total > 0
  const sorted = [...results].sort((a, b) => score(b) - score(a))
  const isRecruiter = results[0]?.mode === 'recruiter'

  useEffect(() => {
    if (allDone) return
    setElapsed(0)
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [allDone])

  useEffect(() => {
    if (allDone) return
    const t = setInterval(() => setFunIndex(i => (i + 1) % FUN_MESSAGES.length), 3500)
    return () => clearInterval(t)
  }, [allDone])

  async function handleExportZip() {
    setZipping(true)
    try {
      const zip = new JSZip()
      const ready = sorted.filter(r => r.matchScore)
      await Promise.all(ready.map(async r => {
        const buf = await fetchDocxBuffer(r)
        const filename = `${(r.company || 'company').replace(/\s+/g, '-')}-${(r.jobTitle || 'job').replace(/\s+/g, '-')}.docx`
        zip.file(filename, buf)
      }))
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'cover-letters.zip'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Zip export failed: ' + err.message)
    }
    setZipping(false)
  }

  if (!allDone && total === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-10 text-center px-4">
        {/* Pulsing rings */}
        <div className="relative flex items-center justify-center w-36 h-36">
          <div className="absolute inset-0 rounded-full border border-violet-500/10 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-3 rounded-full border border-violet-500/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.4s' }} />
          <div className="absolute inset-6 rounded-full border border-violet-500/30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.8s' }} />
          <div className="relative w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center text-3xl shadow-lg shadow-violet-500/20">
            ✨
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-2">
          <p className="text-xl font-semibold text-white">{FUN_MESSAGES[funIndex]}</p>
          <p className="text-gray-500 text-sm">Usually about 30 seconds per job — hang tight</p>
          <p className="text-gray-600 text-xs mt-1">{elapsed}s</p>
        </div>

        {/* Bouncing dots */}
        <div className="flex gap-2">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-violet-500"
              style={{ animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {allDone ? (isRecruiter ? 'Candidate Ranking' : 'Results') : (isRecruiter ? 'Evaluating...' : 'Analyzing...')}
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {allDone
              ? isRecruiter
                ? `${done} candidate${done !== 1 ? 's' : ''} evaluated — sorted by fit score`
                : `${done} application${done !== 1 ? 's' : ''} ready — sorted by match score`
              : `${loadingLabel || 'Processing...'} — usually ~30 sec per ${isRecruiter ? 'candidate' : 'job'} (${elapsed}s)`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!allDone && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="w-4 h-4 border-2 border-gray-600 border-t-violet-400 rounded-full animate-spin" />
              {done}/{total} {isRecruiter ? 'candidates' : 'jobs'}
            </div>
          )}
          {allDone && done > 1 && !isRecruiter && (
            <button
              onClick={handleExportZip}
              disabled={zipping}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 hover:text-white disabled:opacity-40 transition-colors border border-gray-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {zipping ? 'Zipping...' : `Export all (${done}) as .zip`}
            </button>
          )}
        </div>
      </div>

      {!allDone && total > 0 && (
        <div className="w-full bg-gray-800 rounded-full h-1.5">
          <div className="bg-violet-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((result, i) => isRecruiter
          ? <RecruiterCard key={i} result={result} />
          : <JobCard key={i} result={result} />
        )}
      </div>
    </div>
  )
}
