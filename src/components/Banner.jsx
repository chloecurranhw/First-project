export default function Banner({ banner, onDismiss }) {
  if (!banner || banner.dismissed) return null

  const parts = []
  if (banner.travelReduction > 0) parts.push(`travel & leisure reduced by ${banner.travelReduction}%`)
  if (banner.healthcareIncrease > 0) parts.push(`healthcare increased by ${banner.healthcareIncrease}%`)

  if (parts.length === 0) return null

  const adjustmentText = parts.join(', ')

  return (
    <div className="banner">
      <p className="banner-text">
        Figures copied from active retirement with the following adjustments:{' '}
        <strong>{adjustmentText}</strong>. All figures are editable. To change these
        defaults, visit Settings.
      </p>
      <button className="banner-dismiss" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
