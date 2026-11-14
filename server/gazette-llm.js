const LANGS = new Set(['en', 'hi', 'ta'])

export function llmConfigured() {
  return !!(process.env.USER_LLM_API_KEY && process.env.USER_LLM_BASE_URL)
}

function clean(text) {
  let s = String(text || '').replace(/\s+/g, ' ').trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  if (s.length > 400) s = s.slice(0, 400).trim()
  return s
}

export async function polishGazette(facts, lang) {
  const key = process.env.USER_LLM_API_KEY
  const base = String(process.env.USER_LLM_BASE_URL || '').replace(/\/$/, '')
  const model = process.env.USER_LLM_MODEL || 'deepseek-chat'
  if (!key || !base || !facts) return ''
  const locale = LANGS.has(lang) ? lang : 'en'
  const url = `${base}/chat/completions`
  const body = {
    model,
    temperature: 0.4,
    max_tokens: 180,
    messages: [
      {
        role: 'system',
        content: 'You write a 2-3 sentence village gazette for Harvest King, an Indian farming board game. Use only the given facts. Do not invent numbers, names, or events. Return plain text only.'
      },
      {
        role: 'user',
        content: `Language: ${locale}. Facts: ${JSON.stringify(facts)}`
      }
    ]
  }
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 4000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key
      },
      body: JSON.stringify(body),
      signal: ac.signal
    })
    if (!res.ok) return ''
    const data = await res.json().catch(() => null)
    const raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
    return clean(raw)
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}
