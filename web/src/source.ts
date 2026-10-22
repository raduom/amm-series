// Find lines of a model's source by how they start, so a page can point at them.
// Throws if a line is missing or matches more than once: the model changed and the page must follow.
export function locate<K extends string>(source: string, starts: Record<K, string>): Record<K, number> {
  const lines = source.split('\n')
  const found = {} as Record<K, number>
  const problems: string[] = []
  for (const key of Object.keys(starts) as K[]) {
    const hits = lines.flatMap((line, i) => (line.trim().startsWith(starts[key]) ? [i] : []))
    if (hits.length === 1) found[key] = hits[0]
    else problems.push(`${key}: "${starts[key]}" matches ${hits.length} lines`)
  }
  if (problems.length > 0) throw new Error(`The model's source changed:\n  ${problems.join('\n  ')}`)
  return found
}
