import { apiFetch } from '../api.js'
import { useState } from 'react'

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="text-xs px-3 py-1 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function Section({ title, children, action, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 border-b border-gray-800 hover:bg-gray-800/40 transition-colors"
      >
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {action}
          <svg className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  )
}

export default function ResultsStep({ results }) {
  const { jobTitle, company, matchScore, matchSummary, tailoredBullets,
    coverLetter: initialCoverLetter, emailDraft, gapAnalysis,
    salaryEstimate, salaryContext, companySummary, interviewQuestions } = results

  const [coverLetter, setCoverLetter] = useState(initialCoverLetter || '')
  const [downloading, setDownloading] = useState(false)

  const scoreColor = matchScore >= 75 ? 'text-green-400' : matchScore >= 50 ? 'text-yellow-400' : 'text-red-400'
  const scoreRingColor = matchScore >= 75 ? 'stroke-green-500' : matchScore >= 50 ? 'stroke-yellow-500' : 'stroke-red-500'
  const circumference = 2 * Math.PI * 28
  const dashOffset = circumference - (matchScore / 100) * circumference

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await apiFetch('/api/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle, company, coverLetter, tailoredBullets })
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cover-letter-${(company || 'application').toLowerCase().replace(/\s+/g, '-')}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Download failed: ' + err.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-white">{jobTitle || 'Your application is ready'}</h1>
          {company && <p className="text-gray-400 text-sm mt-0.5">{company}</p>}
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 hover:text-white disabled:opacity-40 transition-colors border border-gray-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {downloading ? 'Exporting...' : 'Download .docx'}
        </button>
      </div>

      {/* Match Score */}
      <Section title="Match Score">
        <div className="flex items-center gap-6">
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#1f2937" strokeWidth="6" />
              <circle cx="32" cy="32" r="28" fill="none" className={scoreRingColor} strokeWidth="6" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xl font-bold ${scoreColor}`}>{matchScore}</span>
            </div>
          </div>
          <div className="space-y-2 flex-1">
            <p className="text-gray-300 text-sm leading-relaxed">{matchSummary}</p>
            {salaryEstimate && (
              <div>
                <p className="text-sm text-gray-400">
                  <span className="text-gray-500">Estimated salary:</span>{' '}
                  <span className="text-white font-medium">{salaryEstimate}</span>
                </p>
                {salaryContext && <p className="text-xs text-gray-500 mt-0.5">{salaryContext}</p>}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Company Summary */}
      {companySummary?.length > 0 && (
        <Section title="About the Company" defaultOpen={false}>
          <ul className="space-y-2">
            {companySummary.map((point, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-300">
                <span className="text-violet-400 shrink-0 mt-0.5">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Gap Analysis */}
      {gapAnalysis?.length > 0 && (
        <Section title="Honest Gap Analysis" defaultOpen={false}>
          <p className="text-xs text-gray-500 mb-3">Areas that may count against you — address these in your cover letter or interviews.</p>
          <ul className="space-y-2">
            {gapAnalysis.map((gap, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-300">
                <span className="text-yellow-500 shrink-0 mt-0.5">⚠</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Tailored Bullets */}
      <Section title="Tailored Resume Bullets" action={<CopyButton text={tailoredBullets.join('\n')} />}>
        <ul className="space-y-3">
          {tailoredBullets.map((bullet, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-300">
              <span className="text-violet-400 mt-0.5 shrink-0">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Cover Letter — editable */}
      <Section title="Cover Letter" action={<CopyButton text={coverLetter} />}>
        <textarea
          value={coverLetter}
          onChange={e => setCoverLetter(e.target.value)}
          className="w-full min-h-64 bg-transparent text-sm text-gray-300 leading-relaxed resize-none focus:outline-none"
          spellCheck
        />
      </Section>

      {/* Email Draft */}
      {emailDraft && (
        <Section title="Application Email" action={<CopyButton text={emailDraft} />} defaultOpen={false}>
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{emailDraft}</p>
        </Section>
      )}

      {/* Interview Questions */}
      <Section title="Likely Interview Questions" defaultOpen={false}>
        <ol className="space-y-3">
          {interviewQuestions.map((q, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-300">
              <span className="text-violet-400 font-semibold shrink-0 w-5">{i + 1}.</span>
              <span>{q}</span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  )
}
