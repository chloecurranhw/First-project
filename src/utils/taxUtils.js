export const JURISDICTIONS = [
  'UAE', 'UK', 'USA', 'Australia',
  'Spain', 'Portugal', 'France', 'Germany',
  'Netherlands', 'Italy', 'Cyprus', 'Ireland', 'Malta', 'Greece',
]

export const JURISDICTION_INFLATION = {
  UAE: 1.8,
  UK: 2.5, USA: 2.5, Australia: 2.5,
  Spain: 2.5, Portugal: 2.5, France: 2.5, Germany: 2.5,
  Netherlands: 2.5, Italy: 2.5, Cyprus: 2.5, Ireland: 2.5, Malta: 2.5, Greece: 2.5,
}

// ── UK: progressive 20% / 40% above personal allowance ────────
function grossUp_UK(netTaxable) {
  if (netTaxable <= 0) return 0
  if (netTaxable <= 12570) return netTaxable          // within personal allowance
  const NET_AT_BASIC_LIMIT = 42730                   // net when gross = £50,270
  if (netTaxable <= NET_AT_BASIC_LIMIT) {
    // net = 0.80 × gross + 2,514  →  gross = (net − 2,514) / 0.80
    return (netTaxable - 2514) / 0.80
  }
  // net = 42,730 + (gross − 50,270) × 0.60
  return 50270 + (netTaxable - NET_AT_BASIC_LIMIT) / 0.60
}

// ── Spain: 19% / 24% / 30% / 37% ──────────────────────────────
const SP_B1 = 12450 * 0.81            // net at top of band 1 = 10,084.50
const SP_B2 = SP_B1 + 7750 * 0.76    // net at top of band 2 = 15,974.50
const SP_B3 = SP_B2 + 15000 * 0.70   // net at top of band 3 = 26,474.50

function grossUp_Spain(net) {
  if (net <= 0) return 0
  if (net <= SP_B1) return net / 0.81
  if (net <= SP_B2) return 12450 + (net - SP_B1) / 0.76
  if (net <= SP_B3) return 20200 + (net - SP_B2) / 0.70
  return 35200 + (net - SP_B3) / 0.63
}

// ── Cyprus: 5% on pension above €3,420 exemption ──────────────
function grossUp_Cyprus_pension(net) {
  if (net <= 0) return 0
  if (net <= 3420) return net                   // fully within exemption
  return (net - 3420 * 0.05) / 0.95            // (net − 171) / 0.95
}

function flatGrossUp(net, rate) {
  if (net <= 0) return 0
  return net / (1 - rate)
}

// ── Pension origin country gross-up ───────────────────────
export const PENSION_ORIGIN_COUNTRIES = ['UK', 'USA', 'Australia', 'Ireland']

export function calcPensionGrossUp_Origin(netPension, originCountry) {
  if (netPension <= 0) return 0
  switch (originCountry) {
    case 'UK':        return grossUp_UK(netPension)       // progressive bands
    case 'USA':       return flatGrossUp(netPension, 0.22) // 22% effective (401k)
    case 'Australia': return netPension                    // 0% super over 60
    case 'Ireland':   return flatGrossUp(netPension, 0.20) // 20% standard rate
    default:          return netPension
  }
}

export function calcGrossUpDual(netIncome, incomeTypeSplit, residenceJurisdiction, pensionOriginCountry) {
  if (!netIncome || netIncome <= 0) return null

  const { pension = 0, investment = 0, rental = 0, other = 0 } = incomeTypeSplit
  const splitTotal = pension + investment + rental + other
  if (Math.abs(splitTotal - 100) > 0.5) return null

  const netPension    = netIncome * pension / 100
  const netNonPension = netIncome - netPension

  // Pension: origin country rules
  const grossPension = calcPensionGrossUp_Origin(netPension, pensionOriginCountry)

  // Non-pension: residence country rules, renormalised to 100%
  let grossNonPension = 0
  if (netNonPension > 0) {
    const nonTotal = investment + rental + other
    const renorm = nonTotal > 0
      ? { pension: 0, investment: investment / nonTotal * 100, rental: rental / nonTotal * 100, other: other / nonTotal * 100 }
      : { pension: 0, investment: 0, rental: 0, other: 100 }
    const res = calcGrossUp(netNonPension, renorm, residenceJurisdiction)
    grossNonPension = res ? res.gross : netNonPension
  }

  const totalGross = grossPension + grossNonPension
  const taxGap = totalGross - netIncome
  const effectiveRate = totalGross > 0 ? (taxGap / totalGross) * 100 : 0

  return {
    net: Math.round(netIncome),
    gross: Math.round(totalGross),
    taxGap: Math.round(taxGap),
    effectiveRate: Math.round(effectiveRate * 10) / 10,
    pensionNet: Math.round(netPension),
    pensionGross: Math.round(grossPension),
    nonPensionNet: Math.round(netNonPension),
    nonPensionGross: Math.round(grossNonPension),
    flags: [],
    specialistAdvice: false,
  }
}

// ── Main export ────────────────────────────────────────────────
export function calcGrossUp(netIncome, incomeTypeSplit, jurisdiction) {
  if (!netIncome || netIncome <= 0 || !jurisdiction) return null

  const { pension = 0, investment = 0, rental = 0, other = 0 } = incomeTypeSplit
  const splitTotal = pension + investment + rental + other
  if (Math.abs(splitTotal - 100) > 0.5) return null

  const netP = netIncome * pension / 100
  const netI = netIncome * investment / 100
  const netR = netIncome * rental / 100
  const netO = netIncome * other / 100

  let grossP, grossI, grossR, grossO, rateNote, flags = [], specialistAdvice = false

  switch (jurisdiction) {
    case 'UAE':
      grossP = netP; grossI = netI; grossR = netR; grossO = netO
      rateNote = '0% — no income tax in the UAE'
      break

    case 'UK': {
      // ISA (investment portfolio) is tax-free; everything else taxable through bands
      const taxableNet = netP + netR + netO
      const taxableGross = grossUp_UK(taxableNet)
      const ratio = taxableNet > 0 ? taxableGross / taxableNet : 1
      grossP = netP * ratio
      grossI = netI           // ISA withdrawals: tax-free
      grossR = netR * ratio
      grossO = netO * ratio
      rateNote = 'Pension, rental & other: 20% basic / 40% higher rate. ISA withdrawals: tax-free.'
      break
    }

    case 'USA':
      // Roth IRA (investment) is tax-free; 401(k)/traditional IRA taxable at 22% effective
      grossP = flatGrossUp(netP, 0.22)
      grossI = netI           // Roth IRA: tax-free
      grossR = flatGrossUp(netR, 0.22)
      grossO = flatGrossUp(netO, 0.22)
      rateNote = '22% effective rate on 401(k) / traditional IRA. Roth IRA withdrawals: tax-free.'
      break

    case 'Australia':
      // Super drawdown over age 60: 0%; other income: 32.5%
      grossP = netP           // super: tax-free
      grossI = flatGrossUp(netI, 0.325)
      grossR = flatGrossUp(netR, 0.325)
      grossO = flatGrossUp(netO, 0.325)
      rateNote = 'Super drawdown (age 60+): 0%. Other income: 32.5% marginal rate.'
      break

    case 'Spain': {
      const totalNet = netP + netI + netR + netO
      const totalGross = grossUp_Spain(totalNet)
      const ratio = totalNet > 0 ? totalGross / totalNet : 1
      grossP = netP * ratio; grossI = netI * ratio; grossR = netR * ratio; grossO = netO * ratio
      rateNote = 'Progressive: 19% / 24% / 30% / 37%'
      break
    }

    case 'Portugal':
      grossP = flatGrossUp(netP, 0.28)
      grossI = flatGrossUp(netI, 0.28)
      grossR = flatGrossUp(netR, 0.28)
      grossO = flatGrossUp(netO, 0.28)
      rateNote = '28% standard rate on all income.'
      flags.push('NHR/MHR regime may apply giving a flat 10% rate on foreign pension income for 10 years. Specialist advice strongly recommended.')
      specialistAdvice = true
      break

    case 'Cyprus':
      // 5% flat on pension above €3,420; other income estimated at 25%
      grossP = grossUp_Cyprus_pension(netP)
      grossI = flatGrossUp(netI, 0.25)
      grossR = flatGrossUp(netR, 0.25)
      grossO = flatGrossUp(netO, 0.25)
      rateNote = 'Pension: 5% on income above €3,420 exemption. Other income: est. 25%.'
      flags.push('Specialist advice recommended to access the 5% flat pension rate.')
      specialistAdvice = true
      break

    default:
      // All other EU jurisdictions: 25% flat
      grossP = flatGrossUp(netP, 0.25)
      grossI = flatGrossUp(netI, 0.25)
      grossR = flatGrossUp(netR, 0.25)
      grossO = flatGrossUp(netO, 0.25)
      rateNote = 'Estimated 25% flat rate.'
      flags.push('Estimated rate — jurisdiction-specific advice strongly recommended.')
      specialistAdvice = true
  }

  const totalGross = grossP + grossI + grossR + grossO
  const taxGap = totalGross - netIncome
  const effectiveRate = totalGross > 0 ? (taxGap / totalGross) * 100 : 0

  return {
    net: Math.round(netIncome),
    gross: Math.round(totalGross),
    taxGap: Math.round(taxGap),
    effectiveRate: Math.round(effectiveRate * 10) / 10,
    rateNote,
    flags,
    specialistAdvice,
  }
}
