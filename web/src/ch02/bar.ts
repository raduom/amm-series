import type { Pool } from './model'

// A pool's two reserves as a bar, each segment as wide as its share of the total. A reserve that
// isn't empty keeps a sliver you can see, and an empty one is named on the bar.
export function drawBar(bar: HTMLElement, p: Pool) {
  const sum = p.gold + p.silver
  const share = sum === 0 ? 50 : (p.gold / sum) * 100
  const a = p.gold === 0 ? 0 : p.silver === 0 ? 100 : Math.min(97, Math.max(3, share))
  const segA = bar.querySelector<HTMLElement>('.seg.a')!
  const segB = bar.querySelector<HTMLElement>('.seg.b')!
  segA.style.width = `${a}%`
  segB.style.width = `${100 - a}%`
  segA.innerHTML = `${p.gold}<small>gold</small>`
  segB.innerHTML = `<small>silver</small>${p.silver}`
  segA.dataset.size = size(a)
  segB.dataset.size = size(100 - a)
  if (p.gold === 0) bar.dataset.empty = 'gold'
  else if (p.silver === 0) bar.dataset.empty = 'silver'
  else delete bar.dataset.empty
}

// How much room a bar segment has for its labels.
function size(percent: number): string {
  return percent < 9 ? 'tiny' : percent < 24 ? 'narrow' : 'wide'
}
