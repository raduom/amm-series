// Just enough Haskell highlighting for the models, in GitHub's colours.

export type Kind = 'keyword' | 'type' | 'function' | 'name' | 'number' | 'comment' | 'space' | 'symbol'

export interface Token {
  kind: Kind
  text: string
}

const keywords = new Set([
  'case', 'data', 'deriving', 'else', 'if', 'import', 'in', 'let', 'module', 'of', 'then', 'where',
])

const pattern = /(--.*)|([A-Z][\w']*)|([a-z_][\w']*)|(\d+)|(\s+)|([!#$%&*+./<=>?@\\^|~:-]+)|(.)/g

export function tokenize(line: string): Token[] {
  return [...line.matchAll(pattern)].map((m, i) => {
    const [text, comment, upper, lower, number, space] = m
    const kind: Kind = comment ? 'comment'
      : upper ? 'type'
      : lower ? (keywords.has(lower) ? 'keyword' : i === 0 ? 'function' : 'name')
      : number ? 'number'
      : space ? 'space'
      : 'symbol'
    return { kind, text }
  })
}
