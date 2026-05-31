import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import mammoth from 'mammoth'
import * as cheerio from 'cheerio'
import Anthropic from '@anthropic-ai/sdk'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, 'dist')
const APP_PASSCODE = process.env.APP_PASSCODE || ''

const app = express()
app.use(cors())
app.use(express.json({ limit: '50kb' }))

// Passcode middleware — protects all /api routes
function requirePasscode(req, res, next) {
  if (!APP_PASSCODE) return next() // no passcode set = open
  const code = req.headers['x-passcode']
  if (code !== APP_PASSCODE) return res.status(401).json({ error: 'Invalid passcode' })
  next()
}
app.use('/api', requirePasscode)

// Simple in-memory rate limiter — 20 analyze calls per IP per hour
const rateLimitMap = new Map()
function analyzeRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress
  const now = Date.now()
  const window = 60 * 60 * 1000
  const hits = (rateLimitMap.get(ip) || []).filter(t => now - t < window)
  if (hits.length >= 20) return res.status(429).json({ error: 'Too many requests — please try again later.' })
  hits.push(now)
  rateLimitMap.set(ip, hits)
  next()
}

// Simple URL result cache — keyed by url+resumeHash, TTL 1 hour
const resultCache = new Map()
function cacheKey(jobDescription, resume) {
  let hash = 0
  for (const c of resume + jobDescription) hash = (Math.imul(31, hash) + c.charCodeAt(0)) | 0
  return hash.toString()
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
const client = new Anthropic()

const TONE_INSTRUCTIONS = {
  professional: 'Use a formal, polished, and professional tone throughout.',
  friendly: 'Use a warm, personable, and approachable tone — still professional but conversational.',
  enthusiastic: 'Use an energetic, passionate tone that conveys genuine excitement about the role and company.',
}

// Passcode check
app.get('/api/ping', (req, res) => res.json({ ok: true }))

// Parse resume from uploaded PDF or DOCX
app.post('/api/parse-resume', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const { mimetype, buffer, originalname } = req.file
  try {
    let text = ''
    if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
      const result = await pdfParse(buffer)
      text = result.text
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      originalname.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else {
      return res.status(400).json({ error: 'Only PDF and DOCX files are supported' })
    }
    if (!text.trim()) return res.status(400).json({ error: 'Could not extract text from file' })
    res.json({ text: text.trim() })
  } catch (err) {
    console.error('parse-resume error:', err)
    res.status(500).json({ error: 'Failed to parse file. Make sure it is a valid PDF or DOCX.' })
  }
})

// Clean up raw copy-pasted LinkedIn profile text using Claude
app.post('/api/clean-linkedin', async (req, res) => {
  const { raw } = req.body
  if (!raw || raw.trim().length < 100) {
    return res.status(400).json({ error: 'Paste more text from your LinkedIn profile' })
  }
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `The following is raw text copied from a LinkedIn profile page. It may contain navigation elements, repeated text, and noise. Extract only the meaningful career information and reformat it as a clean, readable resume in plain text. Include: name, headline, summary, work experience (with dates and bullet points), education, and skills. Remove all LinkedIn UI text, ads, and noise. Do not use em dashes. Return only the cleaned resume text, no explanation.\n\nRAW LINKEDIN TEXT:\n${raw.slice(0, 8000)}`
      }]
    })
    res.json({ text: message.content[0].text.trim().replace(/—/g, ',') })
  } catch (err) {
    console.error('clean-linkedin error:', err)
    res.status(500).json({ error: 'Failed to process LinkedIn text' })
  }
})

// Fetch a job posting by URL (LinkedIn or Finn.no)
app.post('/api/fetch-job', async (req, res) => {
  const { url } = req.body
  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'Please provide a valid job posting URL' })
  }

  const isLinkedIn = url.includes('linkedin.com')
  const isFinn = url.includes('finn.no')

  try {
    let fetchUrl = url
    if (isLinkedIn) {
      const jobIdMatch = url.match(/currentJobId=(\d+)/) || url.match(/\/jobs\/view\/(\d+)/)
      if (jobIdMatch) fetchUrl = `https://www.linkedin.com/jobs/view/${jobIdMatch[1]}/`
    }

    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })

    const html = await response.text()
    const $ = cheerio.load(html)
    $('script, style, nav, footer, header, [aria-hidden="true"]').remove()

    // --- LinkedIn ---
    if (isLinkedIn) {
      if (html.includes('authwall') || html.includes('join-linkedin') || html.includes('checkpoint/lg/login')) {
        return res.status(403).json({ error: 'LinkedIn is asking you to log in. Please paste the job description manually.' })
      }
      const title = $('h1').first().text().trim()
      const company = $('.topcard__org-name-link, .top-card-layout__second-subline').first().text().trim()
      let body = $('.description__text, .show-more-less-html__markup, .job-description').text().replace(/\s+/g, ' ').trim()
      if (!body || body.length < 100) {
        $('section, article, div').each((_, el) => {
          const t = $(el).text().replace(/\s+/g, ' ').trim()
          if (t.length > body.length) body = t
        })
      }
      const text = [title, company, body].filter(Boolean).join('\n\n').slice(0, 8000)
      if (text.length < 100) return res.status(403).json({ error: 'Could not extract job details. Please paste the job description manually.' })
      return res.json({ text })
    }

    // --- Finn.no ---
    if (isFinn) {
      const title = $('h1').first().text().trim()
      let company = ''
      const jsonLd = $('script[type="application/ld+json"]').map((_, el) => $(el).html()).get()
      for (const blob of jsonLd) {
        try {
          const parsed = JSON.parse(blob)
          if (parsed.hiringOrganization?.name) { company = parsed.hiringOrganization.name; break }
        } catch {}
      }
      if (!company) company = $('[class*="employer"], [class*="company"], [class*="arbeidsgiver"]').first().text().trim()
      const paragraphs = []
      $('p, li').each((_, el) => { const t = $(el).text().trim(); if (t.length > 20) paragraphs.push(t) })
      const text = [title, company, paragraphs.join('\n')].filter(Boolean).join('\n\n').slice(0, 8000)
      if (text.length < 100) return res.status(403).json({ error: 'Could not extract job details. Please paste the job description manually.' })
      return res.json({ text })
    }

    // --- Generic fallback: extract raw text, let Claude parse the job details ---
    // First try JSON-LD structured data (works for Greenhouse, many company sites)
    const jsonLd = $('script[type="application/ld+json"]').map((_, el) => $(el).html()).get()
    for (const blob of jsonLd) {
      try {
        const parsed = JSON.parse(blob)
        if (parsed['@type'] === 'JobPosting') {
          const title = parsed.title || ''
          const company = parsed.hiringOrganization?.name || ''
          const desc = parsed.description ? parsed.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''
          const text = [title, company, desc].filter(Boolean).join('\n\n').slice(0, 8000)
          if (text.length > 100) return res.json({ text })
        }
      } catch {}
    }

    // Extract visible page text and ask Claude to identify the job posting content
    const rawText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000)
    if (rawText.length < 200) {
      return res.status(403).json({ error: 'Could not extract content from this page. It may require a login or JavaScript. Please paste the job description manually.' })
    }

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `The following is raw text scraped from a job posting page. Extract only the job-relevant information and reformat it as clean plain text: job title, company name, and the full job description (requirements, responsibilities, qualifications). Remove all navigation, ads, cookie notices, and unrelated content. Return only the cleaned job posting text, no explanation.\n\nRAW PAGE TEXT:\n${rawText}`
      }]
    })

    const text = msg.content[0].text.trim().slice(0, 8000)
    if (text.length < 100) {
      return res.status(403).json({ error: 'Could not extract job details from this page. Please paste the job description manually.' })
    }
    res.json({ text })

  } catch (err) {
    console.error('fetch-job error:', err)
    res.status(500).json({ error: 'Failed to fetch job posting. Please paste the description manually.' })
  }
})

// Analyze a single job application
app.post('/api/analyze', analyzeRateLimit, async (req, res) => {
  const { jobDescription, resume, tone = 'professional' } = req.body
  if (!jobDescription || !resume) {
    return res.status(400).json({ error: 'Missing jobDescription or resume' })
  }

  // Return cached result if available
  const key = cacheKey(jobDescription, resume)
  const cached = resultCache.get(key)
  if (cached && Date.now() - cached.ts < 60 * 60 * 1000) return res.json(cached.data)

  const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional
  const systemPrompt = `You are an expert career coach and resume writer. You help job seekers tailor their applications to specific job descriptions. Be specific, actionable, and concise. Always return valid JSON. Never use em dashes anywhere in your output. Use commas, periods, or rewrite the sentence instead. ${toneInstruction}`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3500,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `RESUME:\n${resume}`, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `Analyze the resume above against this job and return a JSON object with exactly these keys:

- "jobTitle": the job title extracted from the job description
- "company": the company name extracted from the job description
- "matchScore": integer 0-100 representing how well the resume matches the job
- "matchSummary": 1-2 sentence summary of the fit
- "tailoredBullets": array of 5 strong resume bullet points tailored to the job (start each with an action verb)
- "coverLetter": a full professional cover letter (3-4 paragraphs) tailored to the job
- "emailDraft": a short 3-4 sentence email to send when submitting the application, referencing the role and company
- "gapAnalysis": array of 3-5 honest gaps or concerns — skills missing, experience lacking, or things that may count against the candidate for this specific role. Be direct and constructive.
- "salaryEstimate": a realistic salary range string for this specific candidate for this role. Format as "$80,000 - $100,000" or "£45,000 - £60,000". If location is unclear use a general market estimate.
- "salaryContext": one sentence explaining the estimate.
- "companySummary": array of 3-4 short bullet points about the company based only on what can be inferred from the job description
- "interviewQuestions": array of 7 likely interview questions for this specific role
- "linkedinMessage": a short LinkedIn connection request message (under 280 characters), written in first person, warm but professional. Do not use em dashes.

JOB DESCRIPTION:
${jobDescription}

Return only the JSON object, no markdown, no explanation.` }
        ]
      }]
    })

    const raw = message.content[0].text.trim().replace(/—/g, ',')
    const data = JSON.parse(raw)
    resultCache.set(key, { data, ts: Date.now() })
    res.json(data)
  } catch (err) {
    console.error(err)
    if (err instanceof SyntaxError) {
      res.status(500).json({ error: 'AI returned invalid JSON. Please try again.' })
    } else {
      res.status(500).json({ error: err.message || 'Something went wrong' })
    }
  }
})

// Export cover letter + bullets as a Word document
app.post('/api/export-docx', async (req, res) => {
  const { jobTitle, company, coverLetter, tailoredBullets } = req.body
  if (!coverLetter) return res.status(400).json({ error: 'Missing content' })

  try {
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            text: `${jobTitle || 'Job Application'}${company ? ` — ${company}` : ''}`,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Cover Letter', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: '' }),
          ...coverLetter.split('\n').map(line =>
            new Paragraph({
              children: [new TextRun({ text: line, size: 24 })],
              spacing: { after: line.trim() === '' ? 120 : 60 },
            })
          ),
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Tailored Resume Bullets', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: '' }),
          ...(tailoredBullets || []).map(bullet =>
            new Paragraph({
              children: [new TextRun({ text: bullet, size: 24 })],
              bullet: { level: 0 },
            })
          ),
        ]
      }]
    })

    const buffer = await Packer.toBuffer(doc)
    const filename = `cover-letter-${(company || 'application').toLowerCase().replace(/\s+/g, '-')}.docx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (err) {
    console.error('export-docx error:', err)
    res.status(500).json({ error: 'Failed to generate document' })
  }
})

// Serve built React app in production
if (existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get('/{*path}', (req, res) => res.sendFile(join(DIST, 'index.html')))
}

// Catch-all JSON error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Something went wrong' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
