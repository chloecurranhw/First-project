import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { parseCSVText } from '../utils/csvParser'
import { detectColumns, buildTransactions, calcMonthlyAverages, NEEDS_CATEGORIES, categorize, parseDate } from '../utils/transactionUtils'
import { generateId } from '../utils'
import TransactionTable from './TransactionTable'
import ConfirmDialog from './ConfirmDialog'

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

// Group pdf.js text items by y-position so columns reconstruct correctly
async function extractPdfRows(file) {
  const pdfjsLib = await loadPdfJs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const allRows = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const items = content.items.filter(item => item.str?.trim())
    if (!items.length) continue

    // Cluster items within 3 vertical units into the same row
    const rowGroups = []
    for (const item of items) {
      const y = item.transform[5]
      const group = rowGroups.find(g => Math.abs(g.y - y) < 3)
      if (group) {
        group.items.push(item)
      } else {
        rowGroups.push({ y, items: [item] })
      }
    }

    // Sort top-to-bottom (PDF y=0 is at the bottom)
    rowGroups.sort((a, b) => b.y - a.y)

    for (const group of rowGroups) {
      group.items.sort((a, b) => a.transform[4] - b.transform[4])
      const text = group.items.map(i => i.str).join('  ').trim()
      if (text) allRows.push(text)
    }
  }

  return allRows
}

// Heuristic: rows that start with a date and contain an amount are likely transactions
function parsePdfTransactions(rows) {
  const DATE_RE = /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\s+/
  const SKIP_DESC = /^(balance|opening|closing|brought forward|carried forward|b\/f|c\/f|total|sub.?total|available)/i
  const txns = []

  for (const row of rows) {
    const dateMatch = row.match(DATE_RE)
    if (!dateMatch) continue

    const rest = row.slice(dateMatch[0].length).trim()

    // Skip credit lines
    if (/\bCR\b/i.test(rest) && !/\bDR\b/i.test(rest)) continue

    // Find all decimal amounts (e.g. 1,234.56 or 45.00)
    const amounts = []
    const amtRe = /\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/g
    let m
    while ((m = amtRe.exec(rest)) !== null) {
      amounts.push({ value: parseFloat(m[1].replace(/,/g, '')), index: m.index })
    }
    if (!amounts.length) continue

    // First amount is the transaction; any subsequent ones are likely a running balance
    const { value: amount, index: amtIdx } = amounts[0]
    if (amount <= 0) continue

    const desc = rest.slice(0, amtIdx).trim()
    if (!desc || SKIP_DESC.test(desc)) continue

    txns.push({
      id: generateId(),
      date: parseDate(dateMatch[1]),
      description: desc,
      amount,
      category: categorize(desc),
      included: true,
    })
  }

  return txns
}

function downloadCSV(transactions) {
  const rows = [['Date', 'Description', 'Amount']]
  for (const t of transactions.filter(t => t.included)) {
    rows.push([t.date, `"${(t.description || '').replace(/"/g, '""')}"`, t.amount])
  }
  const csv = rows.map(r => r.join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: 'transactions.csv' })
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function downloadText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ImportPanel({ onClose, monthColumns, onMonthColumnsChange, defaultTargetIdx = 0 }) {
  const [step, setStep]             = useState('upload') // upload|sheets|mapping|review|pdf-fallback
  const [dragging, setDragging]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError]           = useState('')
  const [sheetsInfo, setSheetsInfo] = useState(null)
  const [rawData, setRawData]       = useState(null)
  const [mapping, setMapping]       = useState({ dateCol: '', descCol: '', amountCol: '', amount2Col: '' })
  const [transactions, setTransactions] = useState([])
  const [viewMode, setViewMode]     = useState('all')
  const [targetMonth, setTargetMonth] = useState(defaultTargetIdx)
  const [mergeDialog, setMergeDialog] = useState(null)
  const [pdfRawText, setPdfRawText] = useState('')
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
        processRawData(parseCSVText(await file.text()))
      } else {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
        if (wb.SheetNames.length > 1) {
          setSheetsInfo({ workbook: wb, sheetNames: wb.SheetNames })
          setStep('sheets')
        } else {
          processExcelSheet(wb, wb.SheetNames[0])
        }
      }
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }, []) // eslint-disable-line

  async function handlePDF(file) {
    setLoadingMsg('Extracting text from PDF…')
    const rows = await extractPdfRows(file)
    const rawText = rows.join('\n')

    if (rawText.length < 100) {
      setError("This looks like a scanned (image-based) PDF — the text isn't selectable. Please log into your bank's website and download your statement as CSV or Excel instead.")
      return
    }

    setLoadingMsg('Parsing transactions…')
    const txns = parsePdfTransactions(rows)

    if (!txns.length) {
      setPdfRawText(rawText)
      setStep('pdf-fallback')
      return
    }

    setTransactions(txns)
    setStep('review')
  }

  function processExcelSheet(wb, sheetName) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' })
    if (!rows.length) { setError('The selected sheet appears to be empty.'); return }
    processRawData({ headers: Object.keys(rows[0]), rows })
  }

  function processRawData({ headers, rows }) {
    if (!rows.length) { setError('No data rows found.'); return }
    const detected = detectColumns(headers, rows.slice(0, 5))
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
          expenses[idx] = { ...expenses[idx], amount: String(mode === 'add' ? existing + rounded : rounded), frequency: 'monthly' }
        } else {
          expenses.push({ id: generateId(), label: cat, category: NEEDS_CATEGORIES.has(cat) ? 'needs' : 'wants', frequency: 'monthly', amount: String(rounded) })
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

  const privacyNote = (
    <p className="import-privacy">
      🔒 Your bank data is processed entirely on your device and never uploaded anywhere.
    </p>
  )

  const backBtn = step !== 'upload' && (
    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}
      onClick={() => { setStep('upload'); setError(''); setTransactions([]) }}>
      ← Back
    </button>
  )

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal import-modal">
        <div className="modal-header">
          <h2>Import transactions</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {backBtn}
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="import-body">

          {/* ── Upload ── */}
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

          {/* ── Sheet selector ── */}
          {step === 'sheets' && sheetsInfo && (
            <>
              <p className="import-step-label">This Excel file has multiple sheets. Which one contains your transactions?</p>
              <div className="import-sheet-btns">
                {sheetsInfo.sheetNames.map(name => (
                  <button key={name} className="import-sheet-btn"
                    onClick={() => processExcelSheet(sheetsInfo.workbook, name)}>
                    {name}
                  </button>
                ))}
              </div>
              {privacyNote}
            </>
          )}

          {/* ── Column mapping ── */}
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
                  <thead><tr>{rawData.headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
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

          {/* ── PDF fallback ── */}
          {step === 'pdf-fallback' && (
            <>
              <p className="import-step-label">
                We couldn't automatically extract transactions from this PDF — the layout may use a format our parser doesn't recognise.
              </p>
              <p className="import-step-label">
                <strong>Best option:</strong> log into your bank's website and download the statement as CSV or Excel, then re-import it here.
              </p>
              <p className="import-step-label" style={{ marginBottom: 6 }}>
                You can also download the raw text we extracted to inspect it manually:
              </p>
              <textarea
                readOnly
                value={pdfRawText}
                rows={10}
                style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '0.72rem', resize: 'vertical', marginBottom: 10, padding: 8, border: '1px solid var(--border)', borderRadius: 4 }}
              />
              <button className="btn-secondary" onClick={() => downloadText(pdfRawText, 'statement-extracted.txt')}>
                ↓ Download extracted text (.txt)
              </button>
              {privacyNote}
            </>
          )}

          {/* ── Review ── */}
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
                  <button className="btn-secondary" onClick={() => downloadCSV(transactions)}>
                    ↓ Download CSV
                  </button>
                </div>
                {privacyNote}
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
