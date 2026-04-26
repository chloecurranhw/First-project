import { useState, useRef, useEffect } from 'react'
import { exportCSV, exportExcel } from '../utils/exportUtils'

export default function ExportMenu({ monthColumns, emergencyFundState }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleExcel() {
    setOpen(false)
    exportExcel(monthColumns, emergencyFundState)
  }

  function handleCSV() {
    setOpen(false)
    exportCSV(monthColumns)
  }

  return (
    <div className="export-menu-wrap" ref={ref}>
      <button className="export-btn" onClick={() => setOpen(o => !o)}>
        ↓ Export
      </button>
      {open && (
        <div className="export-dropdown">
          <button className="export-option" onClick={handleExcel}>
            <span className="export-option-icon">xlsx</span>
            <span>
              <strong>Export as Excel</strong>
              <br />
              <small>Month columns, savings breakdown, emergency fund</small>
            </span>
          </button>
          <button className="export-option" onClick={handleCSV}>
            <span className="export-option-icon">csv</span>
            <span>
              <strong>Export as CSV</strong>
              <br />
              <small>One row per category per month</small>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
