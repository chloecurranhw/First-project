import { useEffect, useRef, useState } from 'react'
import './Gate.css'

const STORAGE_KEY = 'hoxton-gate-passed'
const TOOL_NAME = 'Retirement & Budget Planner'

const COUNTRIES = [
  'United Arab Emirates', 'United Kingdom', 'United States', 'Australia', 'South Africa',
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia',
  'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus',
  'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana',
  'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon',
  'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
  'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark',
  'Djibouti', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea',
  'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon',
  'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea',
  'Guyana', 'Haiti', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia',
  'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan',
  'Kenya', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia',
  'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia',
  'Maldives', 'Mali', 'Malta', 'Mauritania', 'Mauritius', 'Mexico', 'Moldova', 'Monaco',
  'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nepal',
  'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Macedonia',
  'Norway', 'Oman', 'Pakistan', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay',
  'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore',
  'Slovakia', 'Slovenia', 'Somalia', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka',
  'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan',
  'Tanzania', 'Thailand', 'Togo', 'Trinidad and Tobago', 'Tunisia', 'Turkey',
  'Turkmenistan', 'Uganda', 'Ukraine', 'Uruguay', 'Uzbekistan', 'Venezuela', 'Vietnam',
  'Yemen', 'Zambia', 'Zimbabwe',
]

const PHONE_CODES = [
  ['971', '🇦🇪 +971'], ['44', '🇬🇧 +44'], ['1', '🇺🇸 +1'], ['61', '🇦🇺 +61'],
  ['27', '🇿🇦 +27'], ['91', '🇮🇳 +91'], ['65', '🇸🇬 +65'], ['852', '🇭🇰 +852'],
  ['33', '🇫🇷 +33'], ['49', '🇩🇪 +49'], ['34', '🇪🇸 +34'], ['39', '🇮🇹 +39'],
  ['81', '🇯🇵 +81'], ['86', '🇨🇳 +86'], ['55', '🇧🇷 +55'], ['7', '🇷🇺 +7'],
  ['966', '🇸🇦 +966'], ['974', '🇶🇦 +974'], ['968', '🇴🇲 +968'],
  ['973', '🇧🇭 +973'], ['965', '🇰🇼 +965'],
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function captureUtms() {
  const out = {}
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
  const own = new URLSearchParams(window.location.search)
  keys.forEach(k => { if (own.get(k)) out[k] = own.get(k) })
  try {
    if (window.parent !== window) {
      const parent = new URLSearchParams(window.parent.location.search)
      keys.forEach(k => { if (!out[k] && parent.get(k)) out[k] = parent.get(k) })
    }
  } catch { /* cross-origin */ }
  return out
}

export default function Gate({ children }) {
  const [passed, setPassed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
  })
  const [screen, setScreen] = useState('welcome')
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    country: '', phoneCode: '971', phone: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const utmRef = useRef({})

  useEffect(() => {
    if (passed) return
    utmRef.current = captureUtms()
    const onMessage = e => {
      if (e?.data?.type === 'UTM_PARAMS') {
        const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
        keys.forEach(k => { if (e.data[k]) utmRef.current[k] = e.data[k] })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [passed])

  if (passed) return children

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    if (errors[field]) setErrors(e => ({ ...e, [field]: false }))
  }

  function validate() {
    const e = {}
    if (!form.firstName.trim()) e.firstName = true
    if (!form.lastName.trim()) e.lastName = true
    if (!EMAIL_RE.test(form.email)) e.email = true
    if (!form.country) e.country = true
    if (!form.phone.trim()) e.phone = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(ev) {
    ev.preventDefault()
    if (!validate() || submitting) return
    setSubmitting(true)

    // Fire-and-forget — never block the unlock on Ortto
    try {
      fetch('/api/ortto-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          countryCode: form.phoneCode,
          country: form.country,
          utmParams: utmRef.current,
        }),
      }).catch(err => console.warn('Ortto sync failed:', err))
    } catch (err) {
      console.warn('Ortto sync error:', err)
    }

    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
    setPassed(true)
  }

  return (
    <div className="gate-root">
      <div className="gate-card">
        <div className="gate-header">
          <img
            src="/HoxtonWealth_Lockup_Deep_Green-RGB.png"
            alt="Hoxton Wealth"
            className="gate-logo"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        </div>

        {/* ── Welcome ── */}
        <div className={`gate-screen${screen === 'welcome' ? ' active' : ''}`}>
          <div className="gate-welcome-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M7 14l4-4 4 4 5-5" />
            </svg>
          </div>
          <h1 className="gate-welcome-title">Retirement &amp; Budget Planner</h1>
          <p className="gate-welcome-desc">
            Project your monthly budget, estimate the income you'll need in retirement,
            and see what that means once inflation and tax are factored in.
          </p>
          <div className="gate-welcome-meta">
            <div className="gate-welcome-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              ~5 minutes
            </div>
            <div className="gate-welcome-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              Private &amp; on-device
            </div>
          </div>
          <button
            type="button"
            className="gate-btn-primary"
            onClick={() => setScreen('form')}
          >
            Get Started
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* ── Form ── */}
        <form
          className={`gate-screen${screen === 'form' ? ' active' : ''}`}
          onSubmit={handleSubmit}
          noValidate
        >
          <h2 className="gate-form-title">Tell us about yourself</h2>
          <p className="gate-form-desc">
            We'll use this to send you your results and tailored guidance.
          </p>

          <div className="gate-form-grid">
            <div className={`gate-form-group${errors.firstName ? ' error' : ''}`}>
              <label className="gate-form-label" htmlFor="gate-input-first">First name</label>
              <input
                id="gate-input-first"
                className="gate-form-input"
                type="text"
                autoComplete="given-name"
                value={form.firstName}
                onChange={e => update('firstName', e.target.value)}
              />
              <span className="gate-form-error">Please enter your first name</span>
            </div>

            <div className={`gate-form-group${errors.lastName ? ' error' : ''}`}>
              <label className="gate-form-label" htmlFor="gate-input-last">Last name</label>
              <input
                id="gate-input-last"
                className="gate-form-input"
                type="text"
                autoComplete="family-name"
                value={form.lastName}
                onChange={e => update('lastName', e.target.value)}
              />
              <span className="gate-form-error">Please enter your last name</span>
            </div>

            <div className={`gate-form-group full${errors.email ? ' error' : ''}`}>
              <label className="gate-form-label" htmlFor="gate-input-email">Email</label>
              <input
                id="gate-input-email"
                className="gate-form-input"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
              />
              <span className="gate-form-error">Please enter a valid email</span>
            </div>

            <div className={`gate-form-group full${errors.country ? ' error' : ''}`}>
              <label className="gate-form-label" htmlFor="gate-input-country">Country</label>
              <select
                id="gate-input-country"
                className="gate-form-select"
                value={form.country}
                onChange={e => update('country', e.target.value)}
              >
                <option value="">Select a country…</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="gate-form-error">Please select your country</span>
            </div>

            <div className={`gate-form-group full${errors.phone ? ' error' : ''}`}>
              <label className="gate-form-label" htmlFor="gate-input-phone">Phone</label>
              <div className="gate-phone-row">
                <select
                  id="gate-input-phone-code"
                  className="gate-form-select"
                  value={form.phoneCode}
                  onChange={e => update('phoneCode', e.target.value)}
                  aria-label="Country dial code"
                >
                  {PHONE_CODES.map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
                <input
                  id="gate-input-phone"
                  className="gate-form-input"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={e => update('phone', e.target.value)}
                />
              </div>
              <span className="gate-form-error">Please enter your phone number</span>
            </div>
          </div>

          <button type="submit" className="gate-btn-primary" disabled={submitting}>
            {submitting ? 'Unlocking…' : 'Access the planner'}
            {!submitting && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            )}
          </button>

          <p className="gate-privacy-note">
            🔒 Your information is processed securely. By continuing you agree to be
            contacted by Hoxton Wealth about your results.
          </p>
        </form>
      </div>
    </div>
  )
}
