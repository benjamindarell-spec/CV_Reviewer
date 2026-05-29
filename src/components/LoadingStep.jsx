import { useEffect, useState } from 'react'

const STEPS = [
  'Reading job description...',
  'Analyzing your resume...',
  'Identifying skill gaps...',
  'Writing tailored bullets...',
  'Drafting cover letter...',
  'Generating interview questions...',
]

export default function LoadingStep({ label }) {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(s => (s < STEPS.length - 1 ? s + 1 : s))
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-96 gap-8">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-gray-800" />
        <div className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
      </div>

      <div className="text-center space-y-2">
        <p className="text-white font-medium">{label || STEPS[currentStep]}</p>
        <p className="text-gray-500 text-sm">Offerlia is analyzing your application</p>
      </div>

      <div className="flex gap-1.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
              i <= currentStep ? 'bg-violet-500' : 'bg-gray-700'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
