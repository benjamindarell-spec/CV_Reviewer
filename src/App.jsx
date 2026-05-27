import { useState, useEffect } from 'react'
import InputStep from './components/InputStep'
import ResultsStep from './components/ResultsStep'
import LoadingStep from './components/LoadingStep'
import BatchResultsStep from './components/BatchResultsStep'
import HistoryPanel from './components/HistoryPanel'
import PasscodeGate from './components/PasscodeGate'
import { apiFetch } from './api.js'

const HISTORY_KEY = 'jac_history'
const RESUMES_KEY = 'jac_resumes'

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback } catch { return fallback }
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => {
    // In dev (no passcode set), always unlocked
    return !!sessionStorage.getItem('jac_passcode') || import.meta.env.DEV
  })

  if (!unlocked) return <PasscodeGate onUnlock={() => setUnlocked(true)} />

  const [step, setStep] = useState('input')
  const [results, setResults] = useState(null)
  const [batchResults, setBatchResults] = useState([])
  const [error, setError] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState(null)

  const [history, setHistory] = useState(() => loadJSON(HISTORY_KEY, []))
  const [resumes, setResumes] = useState(() => loadJSON(RESUMES_KEY, []))
  const [activeResumeId, setActiveResumeId] = useState(
    () => loadJSON(RESUMES_KEY, [])[0]?.id || null
  )

  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)) }, [history])
  useEffect(() => { localStorage.setItem(RESUMES_KEY, JSON.stringify(resumes)) }, [resumes])

  function saveResume(text, id) {
    if (id) {
      setResumes(prev => prev.map(r => r.id === id ? { ...r, text, updatedAt: Date.now() } : r))
    } else {
      const newId = Date.now().toString()
      const newResume = { id: newId, name: `Resume ${resumes.length + 1}`, text, updatedAt: Date.now() }
      setResumes(prev => [...prev, newResume])
      setActiveResumeId(newId)
    }
  }

  function addResume() {
    const newId = Date.now().toString()
    setResumes(prev => [...prev, { id: newId, name: `Resume ${prev.length + 1}`, text: '', updatedAt: Date.now() }])
    setActiveResumeId(newId)
  }

  function deleteResume(id) {
    setResumes(prev => {
      const next = prev.filter(r => r.id !== id)
      if (activeResumeId === id) setActiveResumeId(next[0]?.id || null)
      return next
    })
  }

  function renameResume(id, name) {
    setResumes(prev => prev.map(r => r.id === id ? { ...r, name } : r))
  }

  function addToHistory(result) {
    setHistory(prev => [{ id: Date.now(), date: new Date().toISOString(), status: null, ...result }, ...prev].slice(0, 50))
  }

  function updateHistoryStatus(id, status) {
    setHistory(prev => prev.map(e => e.id === id ? { ...e, status } : e))
  }

  async function handleAnalyze({ jobDescription, resume, tone, resumeId }) {
    setStep('loading')
    setLoadingLabel(null)
    setError(null)
    saveResume(resume, resumeId)
    try {
      const res = await apiFetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, resume, tone })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      addToHistory(data)
      setResults(data)
      setStep('results')
    } catch (err) {
      setError(err.message)
      setStep('input')
    }
  }

  async function handleBatch({ jobs, resume, tone, resumeId }) {
    setBatchResults([])
    setStep('batch')
    setError(null)
    saveResume(resume, resumeId)

    const results = []
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]
      setLoadingLabel(`Analyzing ${i + 1} of ${jobs.length}...`)
      try {
        const res = await apiFetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobDescription: job.description, resume, tone })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed')
        addToHistory(data)
        results.push({ ...data, status: 'done' })
      } catch (err) {
        results.push({ jobTitle: job.title || 'Unknown', company: '', status: 'error', error: err.message })
      }
      setBatchResults([...results])
    }
    setLoadingLabel(null)
  }

  function handleReset() {
    setResults(null)
    setBatchResults([])
    setError(null)
    setStep('input')
  }

  const activeResume = resumes.find(r => r.id === activeResumeId) || null

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0">J</div>
          <span className="font-semibold text-white">Job Application Copilot</span>
          <div className="ml-auto flex items-center gap-3">
            {history.length > 0 && (
              <button onClick={() => setShowHistory(true)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                History ({history.length})
              </button>
            )}
            {(step === 'results' || step === 'batch') && (
              <button onClick={handleReset} className="text-sm text-gray-400 hover:text-white transition-colors">
                ← New application
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="fixed bottom-4 left-4 text-xs text-gray-600 select-none">An INVESTICA app</div>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {step === 'input' && (
          <InputStep
            onSubmit={handleAnalyze}
            onBatch={handleBatch}
            error={error}
            resumes={resumes}
            activeResumeId={activeResumeId}
            onSelectResume={setActiveResumeId}
            onAddResume={addResume}
            onDeleteResume={deleteResume}
            onRenameResume={renameResume}
          />
        )}
        {step === 'loading' && <LoadingStep label={loadingLabel} />}
        {step === 'results' && <ResultsStep results={results} />}
        {step === 'batch' && <BatchResultsStep results={batchResults} loadingLabel={loadingLabel} />}
      </main>

      {showHistory && (
        <HistoryPanel
          history={history}
          onClose={() => setShowHistory(false)}
          onLoad={entry => { setResults(entry); setShowHistory(false); setStep('results') }}
          onClear={() => { setHistory([]); setShowHistory(false) }}
          onStatusChange={updateHistoryStatus}
        />
      )}
    </div>
  )
}
