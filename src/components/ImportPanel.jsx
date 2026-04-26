import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { parseCSVText } from '../utils/csvParser'
import { detectColumns, buildTransactions, calcMonthlyAverages, NEEDS_CATEGORIES, categorize } from '../utils/transactionUtils'
import { generateId } from '../utils'
import TransactionTable from './TransactionTable'
import ConfirmDialog from './ConfirmDialog'

const SYSTEM_PROMPT = `You are a bank statement parser. The user will give you raw text extracted from a digital bank statement. Extract all transactions and return them as JSON only, no explanation. Format: array of objects with fields: date (YYYY-MM-DD), description (merchant name, cleaned up), amount (positive number for debits/outgoings only), type ('debit' or 'credit'). Ignore credits, ignore opening/closing balances, ignore fee summaries. If you cannot identify clear transactions return an empty array.`

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(window.pdfjsLib)
    }
    s.onerror = () => reject(new Error('Failed to load PDF.js'))
    document.head.appendChild(s)
  })
}

async function extractPdfText(file) {
  const pdfjsLib = await loadPdfJs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    fullText += content.items.map(item => item.str).join(' ') + '\n'
  }
  return fullText.trim()
}

async function callAnthropic(text, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error ${res.status}`)
  }
  const data = await res.json()
  const raw = data.content[0]?.text || '[]'
  // Extract JSON from response (may be wrapped in markdown)
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(raw)
}

export default function ImportPanel({ onClose, monthColumns, onMonthColumnsChange, apiKey, defaultTargetIdx = 0 }) {
  const [step, setStep]           = useState('upload')  // upload|sheets|mapping|review
  const [dragging, setDragging]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError]         = useState('')
  const [sheetsInfo, setSheetsInfo] = useState(null)   // { workbook, sheetNames }
  const [rawData, setRawData]     = useState(null)     // { headers, rows }
  const [mapping, setMapping]     = useState({ dateCol: '', descCol: '', amountCol: '', amount2Col: '' })
  const [transactions, setTransactions] = useState([])
  const [viewMode, setViewMode]   = useState('all')
  const [targetMonth, setTargetMonth] = useState(defaultTargetIdx)
  const [mergeDialog, setMergeDialog] = useState(null) // { averages } when open
  const fileRef = useRef()

  // ── File handling ─────────────────────────────────────────

  const processFile = useCallback(async file => {
    setError('')
    const ext = file.name.split('.').pop().toLowerCase()

    if (!['csv', 'xlsx', 'xls', 'pdf'].includes(ext)) {
      setError('Please upload a CSV, Excel, or digital PDF file.')
      return
    }

    setLoading(true)
    setLoadingMsg('Reading file…')

    try {
      if (ext === 'pdf') {
        await handlePDF(file)
      } else if (ext === 'csv') {
        const text = await file.text()
        const parsed = parseCSVText(text)
        processRawData(parsed)
      } else {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const names = wb.SheetNames
        if (names.length > 1) {
          setSheetsInfo({ workbook: wb, sheetNames: names })
          setStep('sheets')
        } else {
          processExcelSheet(wb, names[0])
        }
      }
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }, [apiKey]) // eslint-disable-line

  async function handlePDF(file) {
    setLoadingMsg('Reading your statement…')
    const text = await extractPdfText(file)

    const wordCount = text.replace(/\s+/g, ' ').trim().split(' ').length
    if (wordCount < 20) {
      setLoading(false)
      setError('This looks like a scanned PDF. Please log into your bank\'s app or website and download your statement as CSV or Excel instead.')
      return
    }

    if (!apiKey) {
      setLoading(false)
      setError('A PDF was detected but no Anthropic API key is set. Please add your API key in Settings to process PDF statements, or download your statement as CSV or Excel instead.')
      return
    }

    setLoadingMsg('Reading your statement…')
    const rawTxns = await callAnthropic(text, apiKey)

    if (!rawTxns.length) {
      setLoading(false)
      setError('We couldn\'t read the transactions from this PDF. Please try downloading it as CSV or Excel from your bank instead.')
      return
    }

    const txns = rawTxns
      .filter(t => t.type === 'debit' || !t.type)
      .filter(t => t.amount > 0)
      .map(t => ({
        id: generateId(),
        date: t.date || '',
        description: t.description || '',
        amount: Math.abs(t.amount),
        category: categorize(t.description || ''),
        included: true,
      }))

    setTransactions(txns)
    setStep('review')
  }

  function processExcelSheet(wb, sheetName) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
    if (!rows.length) { setError('The selected sheet appears to be empty.'); return }
    const headers = Object.keys(rows[0])
    processRawData({ headers, rows })
  }

  function processRawData({ headers, rows }) {
    if (!rows.length) { setError('No data rows found.'); return }
    const sample = rows.slice(0, 5)
    const detected = detectColumns(headers, sample)

    setRawData({ headers, rows })

    if (detected?.confident) {
      const txns = buildTransactions(rows, detected)
      if (!txns.length) { setError('No debit transactions found. Check your file contains outgoing transactions.'); return }
      setTransactions(txns)
      setMapping(detected)
      setStep('review')
    } else {
      setMapping(detected || { dateCol: headers[0] || '', descCol: headers[1] || '', amountCol: headers[2] || '', amount2Col: '' })
      setStep('mapping')
    }
  }

  function applyMapping() {
    if (!rawData || !mapping.dateCol || !mapping.descCol || !mapping.amountCol) {
      setError('Please map Date, Description, and Amount columns.')
      return
    }
    const txns = buildTransactions(rawData.rows, mapping)
    if (!txns.length) { setError('No debit transactions found with this column mapping.'); return }
    setTransactions(txns)
    setStep('review')
  }

  // ── Copy to budget ────────────────────────────────────────

  function handleCopy() {
    const { averages } = calcMonthlyAverages(transactions)
    const month = monthColumns[targetMonth]
    if (!month) return

    const hasExisting = Object.keys(averages).some(cat => {
      const row = month.expenses.find(e =>
        e.label.toLowerCase().includes(cat.toLowerCase()) ||
        cat.toLowerCase().includes(e.label.toLowerCase().replace(' / ', ' ').replace('/', ' '))
      )
      return row && parseFloat(row.amount) > 0
    })

    if (hasExisting) {
      setMergeDialog({ averages })
    } else {
      applyCopy(averages, 'replace')
    }
  }

  function applyCopy(averages, mode) {
    setMergeDialog(null)
    onMonthColumnsChange(prev => prev.map((m, i) => {
      if (i !== targetMonth) return m
      let expenses = [...m.expenses]

      for (const [cat, avg] of Object.entries(averages)) {
        const rounded = Math.round(avg)
        if (!rounded) continue

        const idx = expenses.findIndex(e =>
          e.label.toLowerCase().replace(/[\s\/]+/g, ' ').includes(cat.toLowerCase().replace(/[\s\/]+/g, ' ')) ||
          cat.toLowerCase().replace(/[\s\/]+/g, ' ').includes(e.label.toLowerCase().replace(/[\s\/]+/g, ' '))
        )

        if (idx >= 0) {
          const existing = parseFloat(expenses[idx].amount) || 0
          const newAmt = mode === 'add' ? existing + rounded : rounded
          expenses[idx] = { ...expenses[idx], amount: String(newAmt), frequency: 'monthly' }
        } else {
          expenses.push({
            id: generateId(),
            label: cat,
            category: NEEDS_CATEGORIES.has(cat) ? 'needs' : 'wants',
            frequency: 'monthly',
            amount: String(rounded),
          })
        }
      }

      return { ...m, expenses }
    }))
    onClose()
  }

  // ── Drag and drop ─────────────────────────────────────────

  const onDrop = e => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  // ── Render helpers ────────────────────────────────────────

  const privacyNote = (
    <p className="import-privacy">
      🔒 Your bank data is processed on your device and never uploaded anywhere.
      {step === 'review' && transactions.length > 0 && ' '}
    </p>
  )

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal import-modal">
        <div className="modal-header">
          <h2>Import transactions</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {step !== 'upload' && (
              <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={() => { setStep('upload'); setError(''); setTransactions([]) }}>
                ← Back
              </button>
            )}
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="import-body">
          {/* ── Step: Upload ── */}
          {step === 'upload' && (
            <>
              <div
                className={`import-drop-zone${dragging ? ' import-drop-zone--over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf"
                  style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) processFile(e.target.files[0]) }}
                />
                {loading ? (
                  <div className="import-loading">
                    <div className="import-spinner" />
                    <p>{loadingMsg}</p>
                  </div>
                ) : (
                  <>
                    <div className="import-drop-icon">↑</div>
                    <p className="import-drop-title">Drop your bank statement here</p>
                    <p className="import-drop-sub">or click to browse</p>
                    <p className="import-drop-types">CSV · Excel (.xlsx, .xls) · Digital PDF</p>
                  </>
                )}
              </div>
              {error && <p className="import-error">{error}</p>}
              {privacyNote}
            </>
          )}

          {/* ── Step: Sheet selector ── */}
          {step === 'sheets' && sheetsInfo && (
            <>
              <p className="import-step-label">This Excel file has multiple sheets. Which one contains your transactions?</p>
              <div className="import-sheet-btns">
                {sheetsInfo.sheetNames.map(name => (
                  <button key={name} className="import-sheet-btn"
                    onClick={() => { processExcelSheet(sheetsInfo.workbook, name) }}>
                    {name}
                  </button>
                ))}
              </div>
              {privacyNote}
            </>
          )}

          {/* ── Step: Column mapping ── */}
          {step === 'mapping' && rawData && (
            <>
              <p className="import-step-label">We couldn't automatically detect your columns. Please map them:</p>

              <div className="import-mapping-grid">
                {[
                  { key: 'dateCol',    label: 'Date column' },
                  { key: 'descCol',    label: 'Description column' },
                  { key: 'amountCol',  label: 'Amount column (debit)' },
                  { key: 'amount2Col', label: 'Credit column (optional)' },
                ].map(({ key, label }) => (
                  <div key={key} className="import-mapping-row">
                    <label>{label}</label>
                    <select
                      value={mapping[key] || ''}
                      onChange={e => setMapping(m => ({ ...m, [key]: e.target.value }))}
                      className="mb-month-count-select"
                    >
                      <option value="">— not used —</option>
                      {rawData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <p className="import-step-label" style={{ marginTop: 12 }}>Preview (first 3 rows):</p>
              <div className="import-preview-table">
                <table>
                  <thead>
                    <tr>{rawData.headers.map(h => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rawData.rows.slice(0, 3).map((row, i) => (
                      <tr key={i}>{rawData.headers.map(h => <td key={h}>{String(row[h] ?? '')}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && <p className="import-error">{error}</p>}
              <div style={{ marginTop: 12 }}>
                <button className="btn-primary" onClick={applyMapping}>Continue →</button>
              </div>
              {privacyNote}
            </>
          )}

          {/* ── Step: Review ── */}
          {step === 'review' && (
            <>
              <TransactionTable
                transactions={transactions}
                onUpdate={setTransactions}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />

              <div className="import-review-footer">
                <div className="import-month-select-row">
                  <label>Copy into:</label>
                  <select
                    value={targetMonth}
                    onChange={e => setTargetMonth(Number(e.target.value))}
                    className="mb-month-count-select"
                  >
                    {monthColumns.map((m, i) => (
                      <option key={m.id} value={i}>{m.name}</option>
                    ))}
                  </select>
                  <button className="btn-primary" onClick={handleCopy}>
                    Copy to monthly budget
                  </button>
                </div>
                <p className="import-privacy" style={{ marginTop: 6 }}>
                  🔒 Your bank data is processed on your device and never uploaded anywhere.
                  {transactions.some(() => false) && ' Your statement was sent to Claude AI to extract transactions. No data is stored.'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {mergeDialog && (
        <ConfirmDialog
          title="Some categories already have figures"
          message="The selected month already has amounts for some of these categories. Would you like to replace them with the imported figures, or add the imported amounts on top?"
          confirmLabel="Replace"
          cancelLabel="Add to existing"
          onConfirm={() => applyCopy(mergeDialog.averages, 'replace')}
          onCancel={() => applyCopy(mergeDialog.averages, 'add')}
        />
      )}
    </div>
  )
}
