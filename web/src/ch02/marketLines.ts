import { locate } from '../source'

// What the market widget shows of model/test/AMM/MarketPriceProperties.hs: one property at a
// time, under the helper it uses. The constant-product value property uses poolValue from
// model/src/AMM/ConstantProduct.hs, so that helper comes from there. Lines are found by how
// they start, and the build fails if one is missing or matches more than one line.
export const marketProperties = {
  sumValue: { label: 'Sum: value', name: 'prop_sumValueNeverDecreases', helper: 'sumPoolValue ::' },
  productValue: { label: 'Product: value', name: 'prop_productValueNeverDecreases', helper: 'poolValue ::' },
  sumEmptied: { label: 'Sum: emptied', name: 'prop_sumNeverEmptied', helper: 'sumPoolStocked ::' },
  productEmptied: { label: 'Product: emptied', name: 'prop_productNeverEmptied', helper: 'productPoolStocked ::' },
} as const

export type MarketProperty = keyof typeof marketProperties

// Each property under its helper, as the lines to show.
export function marketExcerpts(market: string, product: string): Record<MarketProperty, string[]> {
  const keys = Object.keys(marketProperties) as MarketProperty[]
  const props = locate(market, Object.fromEntries(keys.map((k) => [k, `${marketProperties[k].name} ::`])))
  const helpers = locate(market, Object.fromEntries(keys.filter((k) => k !== 'productValue')
    .map((k) => [k, marketProperties[k].helper])))
  const poolValue = locate(product, { poolValue: marketProperties.productValue.helper }).poolValue
  const m = market.split('\n')
  const p = product.split('\n')
  return Object.fromEntries(keys.map((k) => {
    const helper = k === 'productValue'
      ? ['-- From AMM.ConstantProduct, imported as CP:', ...block(p, poolValue)]
      : block(m, helpers[k as Exclude<MarketProperty, 'productValue'>])
    return [k, [...helper, '', ...block(m, props[k])]]
  })) as Record<MarketProperty, string[]>
}

// A declaration with the comment above it: its lines to the next blank one.
function block(lines: string[], from: number): string[] {
  while (from > 0 && lines[from - 1].startsWith('--')) from--
  let end = from
  while (end < lines.length && lines[end].trim() !== '') end++
  return lines.slice(from, end)
}
