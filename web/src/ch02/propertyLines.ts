import type { Fold } from '../code'
import { locate } from '../source'

// What the properties page shows of model/test/AMM/ConstantProductProperties.hs: one property
// at a time, under the helpers it calls, folded. Lines are found by how they start, and the
// build fails if one is missing or matches more than one line.
const helpers = {
  succeeds: { doc: '-- | Check a property of the swaps that succeed', head: 'whenSwapSucceeds pool s check' },
  reserveOut: { doc: '-- | The reserve the swap pays out from', head: 'reserveOut s pool' },
} as const
type Helper = keyof typeof helpers

export const properties = {
  product: {
    label: 'k never falls', name: 'prop_productNeverDecreases', helpers: ['succeeds'],
    lines: { check: "property (gold pool' * silver pool'" },
  },
  below: {
    label: 'Below reserve', name: 'prop_outputBelowReserve', helpers: ['succeeds', 'reserveOut'],
    lines: { check: 'property (amountOut < reserveOut' },
  },
  minimum: {
    label: 'Minimum kept', name: 'prop_outputAtLeastMinimum', helpers: ['succeeds'],
    lines: { check: 'property (amountOut >= minAmountOut' },
  },
  larger: {
    label: 'Larger, worse', name: 'prop_largerTradesWorsePrices', helpers: ['succeeds'],
    lines: {
      case: 'case swap larger pool', refused: 'Left err', got: "Right (amountOut', _)",
      more: "amountOut' >= amountOut", price: ".&&. amountOut' * amountIn s", larger: 'larger = s',
    },
  },
  round: {
    label: 'Round trip', name: 'prop_roundTripNeverProfits', helpers: ['succeeds'],
    lines: { case: 'case swap (Swap (opposite', refused: 'Left _', back: 'Right (back, _)' },
  },
  positive: {
    label: 'Stays positive', name: 'prop_reservesStayPositive', helpers: ['succeeds'],
    lines: { check: "property (gold pool' > 0" },
  },
} as const satisfies Record<string, { label: string; name: string; helpers: readonly Helper[]; lines: Record<string, string> }>

export type Property = keyof typeof properties

export interface Excerpt {
  src: string[]
  folds: Fold[]                 // the helpers
  lines: Record<string, number> // def, call, and the property's own lines
}

export function excerpts(source: string): Record<Property, Excerpt> {
  const lines = source.split('\n')
  const keys = Object.keys(properties) as Property[]
  const docs = Object.fromEntries(Object.entries(helpers).map(([k, h]) => [k, h.doc]))
  const sigs = Object.fromEntries(keys.map((k) => [k, `${properties[k].name} ::`]))
  const at = locate(source, { ...docs, ...sigs } as Record<Helper | Property, string>)
  const blocks = Object.fromEntries((Object.keys(helpers) as Helper[]).map((h) => [h, block(lines, at[h])]))

  return Object.fromEntries(keys.map((k) => {
    const src: string[] = []
    const folds: Fold[] = []
    for (const h of properties[k].helpers) {
      const help = blocks[h]
      const head = locate(help.join('\n'), { head: helpers[h].head }).head
      folds.push({ at: src.length, head: src.length + head, end: src.length + help.length - 1, summary: help[0].slice(4).trim() })
      src.push(...help, '')
    }
    // The property, with the comment above it if it has one.
    let from = at[k]
    while (from > 0 && lines[from - 1].startsWith('--')) from--
    const prop = block(lines, from)
    const { name } = properties[k]
    const starts: Record<string, string> = { def: `${name} pool s`, call: 'whenSwapSucceeds', ...properties[k].lines }
    const found = locate(prop.join('\n'), starts)
    const off = src.length
    src.push(...prop)
    const at2 = Object.fromEntries(Object.entries(found).map(([n, i]) => [n, off + (i as number)]))
    return [k, { src, folds, lines: at2 }]
  })) as Record<Property, Excerpt>
}

// A declaration: its lines from `from` to the next blank one.
function block(lines: string[], from: number): string[] {
  let end = from
  while (end < lines.length && lines[end].trim() !== '') end++
  return lines.slice(from, end)
}
