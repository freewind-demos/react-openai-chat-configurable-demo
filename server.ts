import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.post('/v1/chat/completions', async (req, res) => {
  const targetUrl = (req.headers['x-target-url'] as string || '').replace(/\/$/, '')
  const apiKey = req.headers['x-api-key'] as string

  if (!targetUrl || !apiKey) {
    res.status(400).json({ error: 'Missing X-Target-URL or X-API-Key' })
    return
  }

  try {
    const upstream = await fetch(`${targetUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
    })

    res.status(upstream.status)
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, value)
      }
    })

    if (upstream.body) {
      const reader = upstream.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(Buffer.from(value))
      }
    }
    res.end()
  } catch (e: any) {
    res.status(502).json({ error: 'Proxy failed', message: e.message })
  }
})

const PORT = 52742
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`)
})
