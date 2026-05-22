// Sends lead data to Ortto. Always returns 200 — CRM sync must never block UX.
// TODO: add COUNTRY_TO_ISO mapping so the country field is sent as an ISO code.
// For now we pass the raw country name through.

const TOOL_NAME = 'Retirement & Budget Planner'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const {
      firstName, lastName, email, phone, countryCode, country, utmParams,
    } = req.body || {}

    if (!email) {
      return res.status(400).json({ success: false, error: 'Missing email' })
    }

    const orttoApiKey = process.env.ORTTO_API_KEY
    if (!orttoApiKey) {
      console.error('Missing ORTTO_API_KEY')
      return res.status(200).json({ success: true, warning: 'CRM not configured' })
    }

    const attributes = {
      'str:cm:first-name': firstName || '',
      'str:cm:last-name':  lastName || '',
      'str:cm:email':      email,
      'phn:cm:phone': {
        c: String(countryCode || '971').replace('+', ''),
        n: phone || '',
      },
      'str:cm:country': country || '',
      'str:cm:tool':    TOOL_NAME,
    }

    const utmMap = {
      utm_source:   'str:cm:utm-source',
      utm_medium:   'str:cm:utm-medium',
      utm_campaign: 'str:cm:utm-campaign',
      utm_term:     'str:cm:utm-term',
      utm_content:  'str:cm:utm-content',
    }
    if (utmParams && typeof utmParams === 'object') {
      for (const [k, attrKey] of Object.entries(utmMap)) {
        if (utmParams[k]) attributes[attrKey] = utmParams[k]
      }
    }

    const orttoBody = {
      activities: [
        {
          activity_id: 'act:cm:magnet-form-captured',
          attributes,
          fields: { 'str::email': email },
          location: {
            source_ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null,
            custom: null,
            address: null,
          },
        },
      ],
      merge_by: ['str::email'],
    }

    const orttoRes = await fetch('https://api.eu.ap3api.com/v1/activities/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': orttoApiKey,
      },
      body: JSON.stringify(orttoBody),
    })

    if (!orttoRes.ok) {
      const text = await orttoRes.text()
      console.error(`ORTTO_FAIL status=${orttoRes.status} body=${text}`)
    }

    return res.status(200).json({ success: true, ok: orttoRes.ok })
  } catch (err) {
    console.error('Ortto API error:', err)
    return res.status(200).json({ success: true, warning: 'CRM sync failed silently' })
  }
}
