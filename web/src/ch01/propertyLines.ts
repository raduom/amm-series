import type { Fold } from '../code'
import { locate } from '../source'

// What the properties page shows of model/test/AMM/ConstantSumProperties.hs: one property
// at a time, under the helper it calls, folded. Lines are found by how they start, and
// the build fails if one is missing or matches more than one line.
const helper = '-- | Check a property of the swaps that succeed'

export const properties = {
  sum: { label: 'Sum preserved', name: 'prop_sumPreserved', check: "gold pool' + silver pool' ===" },
  output: { label: 'Output = input', name: 'prop_outputEqualsInput', check: 'amountOut === amountIn s' },
  back: { label: 'Swap back', name: 'prop_swapBackRestores', check: 'swap (Swap (opposite (direction s))' },
  nonNegative: { label: 'Never negative', name: 'prop_reservesNonNegative', check: 'property (gold' },
} as const

export type Property = keyof typeof properties

export interface Excerpt {
  src: string[]
  fold: Fold    // the helper
  def: number   // `prop_… pool s =`
  call: number  // `whenSwapSucceeds pool s $ \… ->`
  check: number // what the property checks
}

export function excerpts(source: string): Record<Property, Excerpt> {
  const lines = source.split('\n')
  const keys = Object.keys(properties) as Property[]
  const starts = Object.fromEntries(keys.map((k) => [k, `${properties[k].name} ::`]))
  const at = locate(source, { helper, ...starts } as Record<Property | 'helper', string>)
  const help = block(lines, at.helper)
  const head = locate(help.join('\n'), { head: 'whenSwapSucceeds pool s check' }).head
  const fold = { at: 0, head, end: help.length - 1, summary: help[0].slice(4).trim() }
  return Object.fromEntries(keys.map((k) => {
    const prop = block(lines, at[k])
    const { name, check } = properties[k]
    const found = locate(prop.join('\n'), { def: `${name} pool s`, call: 'whenSwapSucceeds', check })
    const off = help.length + 1
    const excerpt: Excerpt = {
      src: [...help, '', ...prop],
      fold,
      def: off + found.def,
      call: off + found.call,
      check: off + found.check,
    }
    return [k, excerpt]
  })) as Record<Property, Excerpt>
}

// A declaration: its lines from `from` to the next blank one.
function block(lines: string[], from: number): string[] {
  let end = from
  while (end < lines.length && lines[end].trim() !== '') end++
  return lines.slice(from, end)
}
