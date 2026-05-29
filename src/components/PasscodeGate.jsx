import { useState } from 'react'

export default function PasscodeGate({ onUnlock }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError(false)

    // Test the passcode against a lightweight API call
    try {
      const res = await fetch('/api/ping', {
        headers: { 'x-passcode': code.trim() }
      })
      if (res.ok) {
        sessionStorage.setItem('jac_passcode', code.trim())
        onUnlock(code.trim())
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 relative">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">O</div>
          <h1 className="text-2xl font-bold text-white">Offerlia</h1>
          <p className="text-gray-400 text-sm mt-1">AI-powered job applications, tailored to you.</p>
          <p className="text-gray-500 text-xs mt-3">Enter your access code to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={code}
            onChange={e => { setCode(e.target.value); setError(false) }}
            placeholder="Access code"
            autoFocus
            className={`w-full px-4 py-3 rounded-xl bg-gray-900 border text-gray-100 placeholder-gray-600 text-center text-lg tracking-widest focus:outline-none transition-colors ${
              error ? 'border-red-600 focus:border-red-500' : 'border-gray-700 focus:border-violet-500'
            }`}
          />
          {error && <p className="text-red-400 text-sm text-center">Incorrect code — try again</p>}
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Checking...' : 'Continue →'}
          </button>
        </form>
      </div>
      <div className="fixed bottom-4 left-4 text-xs text-gray-600 select-none">offerlia.net</div>
    </div>
  )
}
