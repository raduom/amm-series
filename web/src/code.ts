import { type Token, tokenize } from './haskell'

// What the current step points at, by line index in the source.
export interface Highlight {
  focus: number[]                // the lines of the expression being read
  uses: number[]                 // lines the focused one reads from
  notes: Map<number, string>     // a short comment shown at the end of a line
  values: Record<string, string> // what each name stands for
  fill: boolean                  // write the values over the names on the highlighted lines
}

export interface View {
  from: number      // first source line shown
  folds: Fold[]     // declarations that can fold
  open: Set<number> // folds the reader opened, by first line
}

// A data declaration with the doc comment above it. Folded, it shows as its first
// line with the comment's first line as a summary.
export interface Fold {
  at: number   // the doc comment's first line
  head: number // the `data` line
  end: number  // the `deriving` line
  summary: string
}

export function foldsIn(src: string[], from: number): Fold[] {
  const out: Fold[] = []
  for (let i = from; i < src.length; i++) {
    if (!src[i].startsWith('-- |')) continue
    let head = i + 1
    while (head < src.length && src[head].startsWith('--')) head++
    if (!src[head]?.startsWith('data ')) continue
    let end = head
    while (end + 1 < src.length && !src[end].trim().startsWith('deriving')) end++
    out.push({ at: i, head, end, summary: src[i].slice(4).trim().replace(/@/g, '') })
    i = end
  }
  return out
}

type Row =
  | { kind: 'line'; at: number; fold?: Fold } // fold: the open declaration this line starts
  | { kind: 'folded'; fold: Fold }
  | { kind: 'blank' }

// Without a highlight the code shows plain, nothing dimmed.
// A line too long for the panel wraps, its continuation indented past the line's own
// indentation, so it can't be mistaken for a line of its own.
export function renderCode(src: string[], view: View, hl?: Highlight): string {
  const heads = new Map(view.folds.map((f) => [f.at, foldHead(src, f)]))
  const width = Math.max(0, ...[...heads.values()].map((h) => h.length))
  return rows(src, view).map((row) => {
    if (row.kind === 'blank') return '<div class="l">&nbsp;</div>'
    if (row.kind === 'folded') {
      const f = row.fold
      const head = heads.get(f.at)!
      return `<div class="l dim">${gutter(src, f, false)}${text(0)}${tokensHtml(tokenize(head))}`
        + `<button class="fold" data-fold="${f.at}" tabindex="-1" aria-hidden="true">…</button>`
        + `${' '.repeat(width - head.length + 2)}<span class="m">-- ${escape(f.summary)}</span></span></div>`
    }
    const line = src[row.at]
    const body = line.trimStart()
    const focus = hl?.focus.includes(row.at) ?? false
    const uses = hl?.uses.includes(row.at) ?? false
    const cls = !hl ? 'l' : focus ? 'l f' : uses ? 'l u' : 'l dim'
    const note = hl?.notes.get(row.at)
    const indent = Math.max(0, line.length - body.length + (focus && hl ? shift(src, row.at, hl) : 0))
    return `<div class="${cls}">${row.fold ? gutter(src, row.fold, true) : ''}`
      + text(indent) + lineHtml(body, focus || uses ? hl : undefined)
      // A note that doesn't fit after the code moves whole to the next row.
      + (note ? `<span class="val">-- ${escape(note)}</span>` : '')
      + '</span></div>'
  }).join('')
}

// Opens a line's text, indented by its leading spaces.
function text(indent: number): string {
  return `<span class="t" style="--in: ${indent}ch">`
}

// The lines to show, from view.from to the last line that isn't blank.
function rows(src: string[], view: View): Row[] {
  const starts = new Map(view.folds.map((f) => [f.at, f]))
  const closed = (f?: Fold) => f !== undefined && !view.open.has(f.at)
  let last = src.length - 1
  while (last > view.from && src[last].trim() === '') last--
  const out: Row[] = []
  for (let i = view.from; i <= last; i++) {
    const f = starts.get(i)
    if (f && closed(f)) {
      out.push({ kind: 'folded', fold: f })
      i = f.end
      // Folded declarations sit together, without the blank lines between them.
      if (src[i + 1]?.trim() === '' && closed(starts.get(i + 2))) i++
      continue
    }
    out.push(src[i].trim() ? { kind: 'line', at: i, fold: f } : { kind: 'blank' })
  }
  return out
}

// `data Pool = ` or `whenSwapSucceeds pool s check = ` for a folded declaration, with the
// ellipsis to follow.
function foldHead(src: string[], f: Fold): string {
  const text = src[f.head]
  const eq = / =( |$)/.exec(text)
  return eq ? `${text.slice(0, eq.index)} = ` : `${text} = `
}

// Drawn rather than a ▸ character, which is tiny in many fonts. It turns down when open.
const chevron = '<svg viewBox="0 0 10 10" aria-hidden="true">'
  + '<path d="M3.5 1.5 7 5 3.5 8.5" fill="none" stroke="currentColor" stroke-width="1.8" '
  + 'stroke-linecap="round" stroke-linejoin="round"/></svg>'

function gutter(src: string[], f: Fold, open: boolean): string {
  const words = src[f.head].split(' ')
  const name = words.slice(0, words[0] === 'data' ? 2 : 1).join(' ')
  return `<button class="gut" data-fold="${f.at}" aria-expanded="${open}" `
    + `aria-label="${open ? 'Fold' : 'Unfold'} ${escape(name)}">${chevron}</button>`
}

// A continuation line of a filled-in expression is indented to line up with something on
// the line above. Values are wider or narrower than the names they replace, so the line
// moves by however much the line above changed before that column.
function shift(src: string[], at: number, hl: Highlight): number {
  if (!hl.fill || !hl.focus.includes(at) || !hl.focus.includes(at - 1)) return 0
  const above = src[at - 1]
  const body = above.trimStart()
  const align = src[at].length - src[at].trimStart().length
  let col = above.length - body.length
  let change = 0
  const tokens = tokenize(body)
  values(tokens, hl).forEach((value, i) => {
    if (value !== undefined && col < align) change += value.length - tokens[i].text.length
    col += tokens[i].text.length
  })
  return shift(src, at - 1, hl) + change
}

// What each token is written as, where a value replaces a name.
// In a binding like `amountOut = amountIn` the name being defined stays, and so do
// the arguments a lambda like `\_ pool' ->` names.
function values(tokens: Token[], hl: Highlight): (string | undefined)[] {
  const named = (t?: Token) => t?.kind === 'name' || t?.kind === 'function'
  const first = tokens.find((t) => t.kind !== 'space')
  const defines = named(first) && hl.values[first!.text] !== undefined ? tokens.findIndex((t) => t.text === '=') : -1
  let lambda = false
  return tokens.map((t, i) => {
    if (t.text === '\\') lambda = true
    else if (t.text === '->') lambda = false
    return named(t) && i > defines && !lambda ? hl.values[t.text] : undefined
  })
}

// A highlighted line marks the names it uses, or writes their values over them.
function lineHtml(text: string, hl?: Highlight): string {
  const tokens = tokenize(text)
  if (!hl) return tokensHtml(tokens)
  const filled = values(tokens, hl)
  return tokens.map((t, i) => {
    const value = filled[i]
    if (value === undefined) return tokenHtml(t)
    if (!hl.fill) return `<span class="v">${escape(t.text)}</span>`
    return `<span class="v ${/^\(?-?\d/.test(value) ? 'n' : 'c'}">${escape(value)}</span>`
  }).join('')
}

// Operators get a class too, so a line can't wrap inside `->`.
const classes: Partial<Record<Token['kind'], string>> = {
  keyword: 'k', type: 'c', function: 'n', number: 'n', comment: 'm', symbol: 'op',
}

function tokensHtml(tokens: Token[]): string {
  return tokens.map(tokenHtml).join('')
}

function tokenHtml(t: Token): string {
  const cls = classes[t.kind]
  return cls ? `<span class="${cls}">${escape(t.text)}</span>` : escape(t.text)
}

export function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
