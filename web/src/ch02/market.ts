import market from '../../../model/test/AMM/MarketPriceProperties.hs?raw'
import product from '../../../model/src/AMM/ConstantProduct.hs?raw'
import * as CS from '../ch01/model'
import { escape } from '../code'
import { codePanel } from '../panel'
import '../widget.css'
import { drawBar } from './bar'
import { type MarketProperty, marketExcerpts, marketProperties } from './marketLines'
import * as CP from './model'
import { mulberry32 } from './random'

// Both pools against a market price. A trader makes the most profitable swap in each pool,
// counted at the market price; the pool's value at that price falls by exactly what the trader
// makes. Under the pools, the market-price properties and what a run of each finds.

type Pool = CP.Pool
type Kind = 'sum' | 'product'

const start: Pool = { gold: 100, silver: 100 }
// Market prices to pick from, in silver per gold, spaced so the slider moves evenly on a log scale.
const prices = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]
const waiting = 'Press Trader swaps: a trader makes the one swap in each pool that earns the most at the market price.'

const template = `
  <div class="ctl stack">
    <label class="amt market">1 gold on the market = <b></b><input type="range" min="0" max="${prices.length - 1}" step="1"></label>
    <button class="btn p" data-act="trade">Trader swaps</button>
    <button class="mini" data-act="reset">Reset</button>
  </div>
  <div class="pools">
    <div class="side" data-kind="sum"><h4>Constant sum <small>chapter 1</small></h4></div>
    <div class="side" data-kind="product"><h4>Constant product</h4></div>
  </div>
  <div class="hd props">
    <div class="tg wide" role="tablist" aria-label="Property"></div>
  </div>
  <div class="code"></div>
  <div class="tally"></div>`

const sideTemplate = `
  <div class="bar"><div class="seg a"></div><div class="seg b"></div></div>
  <dl class="nums"></dl>
  <p class="log"></p>`

export function mountCh02Market(root: HTMLElement) {
  root.classList.add('amm')
  root.innerHTML = template
  const $ = <T extends HTMLElement>(selector: string, from: ParentNode = root) => from.querySelector(selector) as T
  for (const s of root.querySelectorAll('.side')) s.insertAdjacentHTML('beforeend', sideTemplate)
  const slider = $<HTMLInputElement>('.amt input')
  const shown = marketExcerpts(market, product)
  const keys = Object.keys(marketProperties) as MarketProperty[]
  $('.props .tg').innerHTML = keys.map((k) =>
    `<button role="tab" data-prop="${k}">${marketProperties[k].label}</button>`).join('')

  let pi = prices.indexOf(2)
  let pools: Record<Kind, Pool> = { sum: start, product: start }
  let logs: Record<Kind, string> = { sum: waiting, product: waiting }
  let property: MarketProperty = 'sumValue'

  const price = () => prices[pi]
  const listing = (p: MarketProperty) => ({ src: shown[p], from: 0, folds: [] })
  const panel = codePanel($('.code'), 'MarketPriceProperties.hs', keys.map(listing), render)

  function render() {
    const p = price()
    slider.value = String(pi)
    $('.amt b').textContent = `${CP.num(p)} silver`
    for (const kind of ['sum', 'product'] as Kind[]) {
      const side = $(`.side[data-kind="${kind}"]`)
      const pool = pools[kind]
      drawBar($('.bar', side), pool)
      const empty = pool.gold === 0 || pool.silver === 0
      $('.nums', side).innerHTML = `<dt>in the pool</dt><dd${empty ? ' class="empty"' : ''}>`
        + `${pool.gold} gold, ${pool.silver} silver</dd>`
        + `<dt>price in the pool</dt><dd>${kind === 'sum' ? '1 gold = 1 silver, always' : poolPrice(pool)}</dd>`
        + `<dt>value at the market price</dt><dd>${CP.num(CP.poolValue(p, pool))} silver</dd>`
        + `<dt>the starting pool, at this price</dt><dd>${CP.num(CP.poolValue(p, start))} silver</dd>`
      $('.log', side).textContent = logs[kind]
    }
    for (const b of root.querySelectorAll<HTMLElement>('[data-prop]')) {
      b.setAttribute('aria-selected', String(b.dataset.prop === property))
    }
    panel.show(listing(property))
    $('.tally').innerHTML = tally(property)
  }

  function trade() {
    const p = price()
    for (const kind of ['sum', 'product'] as Kind[]) {
      const best = bestTrade(kind, pools[kind], p)
      if (!best) {
        const none = `No swap makes money now: ${whyNot(kind, pools[kind], p)}`
        logs[kind] = logs[kind] !== waiting && !logs[kind].includes('No swap') ? `${logs[kind]} ${none}` : none
        continue
      }
      const before = CP.poolValue(p, pools[kind])
      pools[kind] = best.pool
      const paid = best.direction === 'GoldForSilver' ? 'gold' : 'silver'
      const got = best.direction === 'GoldForSilver' ? 'silver' : 'gold'
      logs[kind] = `The trader paid ${best.amountIn} ${paid} for ${best.amountOut} ${got}, earning `
        + `${CP.num(best.profit)} silver at the market price. The pool's value fell from ${CP.num(before)} to `
        + `${CP.num(CP.poolValue(p, best.pool))}: exactly what the trader earned.`
        + (best.pool.gold === 0 || best.pool.silver === 0 ? ' A side of the pool is empty.'
          : kind === 'product' ? ` The pool now prices 1 gold at ${CP.num(best.pool.silver / best.pool.gold)} silver, `
            + `next to the market's ${CP.num(p)}.` : '')
    }
  }

  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button')
    if (!b || b.disabled || b.closest('.code')) return
    if (b.dataset.act === 'trade') trade()
    else if (b.dataset.act === 'reset') {
      pools = { sum: start, product: start }
      logs = { sum: waiting, product: waiting }
    } else if (b.dataset.prop) {
      property = b.dataset.prop as MarketProperty
      panel.follow()
    } else return
    render()
  })

  slider.addEventListener('input', () => {
    pi = slider.valueAsNumber
    logs = { sum: waiting, product: waiting }
    render()
  })

  render()
  return { setOptions() {} }
}

// The pool's price, written the way round that keeps it readable.
function poolPrice(p: Pool): string {
  if (p.gold === 0 || p.silver === 0) return 'no price'
  return p.silver >= p.gold ? `1 gold = ${CP.num(p.silver / p.gold)} silver` : `1 silver = ${CP.num(p.gold / p.silver)} gold`
}

// Why no swap makes the trader money.
function whyNot(kind: Kind, pool: Pool, price: number): string {
  if (pool.gold === 0 || pool.silver === 0) {
    const [none, left] = pool.gold === 0 ? ['gold', 'silver'] : ['silver', 'gold']
    return `the pool has no ${none} left, and its ${left} costs more than it is worth on the market.`
  }
  const poolsPrice = kind === 'sum' ? 1 : pool.silver / pool.gold
  if (poolsPrice === price) return "the pool's price is the market's, so every swap costs the trader at least what it earns."
  return "the pool's price is close to the market's, and after rounding every swap costs the trader at least what it earns."
}


interface Trade {
  direction: CP.Direction
  amountIn: number
  amountOut: number
  pool: Pool
  profit: number
}

// The swap that makes the trader the most, counted in silver at the market price, if any makes money.
function bestTrade(kind: Kind, pool: Pool, price: number): Trade | undefined {
  let best: Trade | undefined
  for (const direction of ['GoldForSilver', 'SilverForGold'] as const) {
    const most = 10 * Math.max(pool.gold, pool.silver, 1)
    for (let amountIn = 1; amountIn <= most; amountIn++) {
      const r = kind === 'sum'
        ? CS.swap({ direction, amountIn }, pool)
        : CP.swap({ direction, amountIn, minAmountOut: 0 }, pool)
      if (r.tag === 'Left') continue
      const profit = direction === 'GoldForSilver'
        ? r.amountOut - price * amountIn
        : price * r.amountOut - amountIn
      if (profit > 1e-9 && (!best || profit > best.profit)) {
        best = { direction, amountIn, amountOut: r.amountOut, pool: r.pool, profit }
      }
    }
  }
  return best
}

// A case for the market properties: a price of a/b silver per gold, a pool and a swap.
interface Case {
  a: number
  b: number
  gold: number
  silver: number
  up: boolean // GoldForSilver
  amountIn: number
}

function holds(p: MarketProperty, c: Case): boolean | undefined {
  const price = c.a / c.b
  const pool = { gold: c.gold, silver: c.silver }
  const direction: CP.Direction = c.up ? 'GoldForSilver' : 'SilverForGold'
  const stocked = (q: Pool) => q.gold > 0 && q.silver > 0
  const sum = () => CS.swap({ direction, amountIn: c.amountIn }, pool)
  const product = () => CP.swap({ direction, amountIn: c.amountIn, minAmountOut: 0 }, pool)
  switch (p) {
    case 'sumValue': {
      const r = sum()
      return r.tag === 'Left' || CP.poolValue(price, r.pool) >= CP.poolValue(price, pool)
    }
    case 'productValue': {
      const r = product()
      return r.tag === 'Left' || CP.poolValue(price, r.pool) >= CP.poolValue(price, pool)
    }
    case 'sumEmptied': {
      if (!stocked(pool)) return undefined
      const r = sum()
      return r.tag === 'Left' || stocked(r.pool)
    }
    case 'productEmptied': {
      if (!stocked(pool)) return undefined
      const r = product()
      return r.tag === 'Left' || stocked(r.pool)
    }
  }
}

// Cases one at a time, loosely like QuickCheck's: numbers grow as the run goes on.
function generator(seed: number): () => Case {
  const random = mulberry32(seed)
  const upTo = (n: number) => Math.floor(random() * (n + 1))
  let i = 0
  return () => {
    const size = 10 + i++
    return {
      a: 1 + upTo(size), b: 1 + upTo(size), gold: upTo(size), silver: upTo(size),
      up: random() < 0.5, amountIn: upTo(2 * size) - size,
    }
  }
}

// Smaller cases to try in place of a failing one: each number towards its smallest value, and
// the reserves and the amount together, since a swap often only fails while they match.
function smaller(c: Case): Case[] {
  const out: Case[] = []
  const least: Partial<Record<keyof Case, number>> = { a: 1, b: 1, gold: 0, silver: 0, amountIn: 0 }
  const towards = (v: number, lo: number) => [...new Set([lo, Math.trunc(v / 2), v - Math.sign(v)])]
    .filter((w) => Math.abs(w - lo) < Math.abs(v - lo))
  for (const key of Object.keys(least) as (keyof Case)[]) {
    for (const w of towards(c[key] as number, least[key]!)) out.push({ ...c, [key]: w })
  }
  const half = (v: number) => Math.trunc(v / 2)
  const less = (v: number) => (v > 1 ? v - 1 : v)
  out.push({ ...c, gold: half(c.gold), silver: half(c.silver), amountIn: half(c.amountIn) })
  out.push({ ...c, gold: less(c.gold), silver: less(c.silver), amountIn: less(c.amountIn) })
  if (!c.up) out.push({ ...c, up: true })
  return out.filter((d) => JSON.stringify(d) !== JSON.stringify(c))
}

// A run of 100 cases, and the smallest failing case found by shrinking, as QuickCheck reports it.
// Like QuickCheck, a run keeps going until 100 cases weren't discarded.
function tally(p: MarketProperty): string {
  const runs = 100
  const next = generator(7)
  let passed = 0
  let discarded = 0
  let failing: Case | undefined
  while (passed < runs && discarded < 10 * runs) {
    const c = next()
    const ok = holds(p, c)
    if (ok === undefined) discarded++
    else if (ok) passed++
    else {
      failing = c
      break
    }
  }
  if (!failing) {
    return `<pre>+++ OK, passed ${passed} tests; ${discarded} discarded.</pre>`
      + `<p>No swap empties a reserve of the constant-product pool: the output is always below the reserve.</p>`
  }
  let c = failing
  let shrinks = 0
  for (let more = true; more;) {
    more = false
    for (const d of smaller(c)) {
      if (holds(p, d) === false) {
        c = d
        shrinks++
        more = true
        break
      }
    }
  }
  const price = `${c.a} % ${c.b}`
  const direction = c.up ? 'GoldForSilver' : 'SilverForGold'
  const swapShown = p.startsWith('sum') ? `Swap {direction = ${direction}, amountIn = ${c.amountIn}}`
    : `Swap {direction = ${direction}, amountIn = ${c.amountIn}, minAmountOut = 0}`
  const lines = [
    `+++ OK, failed as expected. Falsified (after ${passed + discarded + 1} tests and ${shrinks} shrinks):`,
    ...(p.endsWith('Value') ? [`Positive {getPositive = ${price}}`] : []),
    `Pool {gold = ${c.gold}, silver = ${c.silver}}`,
    swapShown,
  ]
  return `<pre>${escape(lines.join('\n'))}</pre><p>Expected to fail, and it does. ${escape(explain(p, c))}</p>`
}

function explain(p: MarketProperty, c: Case): string {
  const price = c.a / c.b
  const pool = { gold: c.gold, silver: c.silver }
  const direction: CP.Direction = c.up ? 'GoldForSilver' : 'SilverForGold'
  const r = p.startsWith('sum')
    ? CS.swap({ direction, amountIn: c.amountIn }, pool)
    : CP.swap({ direction, amountIn: c.amountIn, minAmountOut: 0 }, pool)
  if (r.tag === 'Left') return ''
  const paid = c.up ? 'gold' : 'silver'
  const got = c.up ? 'silver' : 'gold'
  if (p.endsWith('Value')) {
    return `With 1 gold worth ${CP.num(price)} silver, paying ${c.amountIn} ${paid} for ${r.amountOut} ${got} is a good `
      + `deal for the trader, so the pool's value falls from ${CP.num(CP.poolValue(price, pool))} to `
      + `${CP.num(CP.poolValue(price, r.pool))} silver.`
  }
  return `Paying ${c.amountIn} ${paid} takes all ${r.amountOut} ${got} the pool holds: one for one, nothing stops it.`
}
