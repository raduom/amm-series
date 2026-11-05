import { escape } from '../code'

// Just enough Solidity highlighting for the pool's swap, in GitHub's colours, and a code panel
// for it. The shared panel in ../panel reads Haskell; this one draws the same rows with the same
// classes, so the code looks the same in both.

export type Kind = 'keyword' | 'type' | 'call' | 'name' | 'number' | 'comment' | 'space' | 'symbol'

export interface Token {
  kind: Kind
  text: string
}

const keywords = new Set([
  'bool', 'else', 'emit', 'external', 'false', 'function', 'if', 'return', 'returns', 'revert', 'true', 'uint256',
])

// `msg.sender` and `address(this)` read as one name each, so a value can stand in for them.
const pattern = /(\/\/.*)|(msg\.sender|address\(this\))|([A-Za-z_]\w*)|(\d+)|(\s+)|([!%&*+\-/<=>?^|~:]+)|(.)/g

export function tokenize(line: string): Token[] {
  const tokens = [...line.matchAll(pattern)].map((m): Token => {
    const [text, comment, special, word, number, space] = m
    const kind: Kind = comment ? 'comment'
      : special ? 'name'
      : word ? (keywords.has(word) ? 'keyword' : /^[A-Z]/.test(word) ? 'type' : 'name')
      : number ? 'number'
      : space ? 'space'
      : 'symbol'
    return { kind, text }
  })
  // A name called, like `safeTransferFrom(`, is a function.
  tokens.forEach((t, i) => {
    if (t.kind === 'name' && !t.text.includes('(') && tokens[i + 1]?.text === '(') t.kind = 'call'
  })
  return tokens
}

// What the current step points at, by line index in the listing.
export interface Highlight {
  focus: number[]                // the lines being run
  notes: Map<number, string>     // a short comment shown at the end of a line
  values: Record<string, string> // names on the focused lines to write as values
}

const classes: Partial<Record<Kind, string>> = {
  keyword: 'k', type: 'c', call: 'c', number: 'n', comment: 'm', symbol: 'op',
}

// Without a highlight the code shows plain, nothing dimmed. A long line wraps with a hanging
// indent, as in the Haskell panels.
export function renderSolidity(src: string[], hl?: Highlight): string {
  let last = src.length - 1
  while (last > 0 && src[last].trim() === '') last--
  return src.slice(0, last + 1).map((line, at) => {
    const body = line.trimStart()
    if (body === '') return '<div class="l">&nbsp;</div>'
    const focus = hl?.focus.includes(at) ?? false
    const cls = !hl ? 'l' : focus ? 'l f' : 'l dim'
    const note = hl?.notes.get(at)
    return `<div class="${cls}"><span class="t" style="--in: ${line.length - body.length}ch">`
      + lineHtml(body, focus ? hl!.values : {})
      + (note ? `<span class="val">// ${escape(note)}</span>` : '')
      + '</span></div>'
  }).join('')
}

// A focused line writes values over the names it reads. In an assignment like
// `reserve0 = reserveIn + amountIn;` the name being set stays.
function lineHtml(text: string, values: Record<string, string>): string {
  const tokens = tokenize(text)
  const first = tokens.findIndex((t) => t.kind !== 'space')
  const next = tokens.slice(first + 1).find((t) => t.kind !== 'space')
  const sets = tokens[first]?.kind === 'name' && next?.text === '=' ? first : -1
  return tokens.map((t, i) => {
    const value = t.kind === 'name' && i !== sets ? values[t.text] : undefined
    if (value === undefined) {
      const c = classes[t.kind]
      return c ? `<span class="${c}">${escape(t.text)}</span>` : escape(t.text)
    }
    return `<span class="v ${/^\d|^true$|^false$/.test(value) ? 'n' : 'c'}">${escape(value)}</span>`
  }).join('')
}

// A panel for one listing: a header with the file's name, and the code under it at a fixed
// height, so the controls under it stay put. It scrolls, and follows the highlighted lines.
export function solidityPanel(code: HTMLElement, file: string) {
  code.innerHTML = `<div class="ch"><span>${escape(file)}</span></div><div class="src"></div>`
  const src = code.querySelector<HTMLElement>('.src')!
  let follow = true

  function show(lines: string[], hl?: Highlight) {
    src.innerHTML = renderSolidity(lines, hl)
    if (follow) reveal()
    follow = false
  }

  // Scroll the code, and only the code, so the highlighted lines are in view.
  function reveal() {
    const lines = src.querySelectorAll<HTMLElement>('.l.f')
    if (lines.length === 0) return
    const first = lines[0]
    const last = lines[lines.length - 1]
    const margin = parseFloat(getComputedStyle(src).lineHeight)
    const bottom = last.offsetTop + last.offsetHeight + margin
    if (bottom > src.scrollTop + src.clientHeight) src.scrollTop = bottom - src.clientHeight
    if (first.offsetTop - margin < src.scrollTop) src.scrollTop = Math.max(0, first.offsetTop - margin)
  }

  return {
    show,
    follow() {
      follow = true
    },
  }
}
