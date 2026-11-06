import '../widget.css'
import './growth.css'

// These are the recorded stage ratios, not all divided by today's 65-line contract:
// the first version predates the same-token guard. Keep the article's one-decimal values.
const stages = [
  { label: 'First version', short: 'First', tests: 30, lines: 366, ratio: 5.8 },
  { label: 'After round 2', short: 'Round 2', tests: 42, lines: 535, ratio: 8.2 },
  { label: 'After round 4', short: 'Round 4', tests: 62, lines: 784, ratio: 12.1 },
  { label: 'After round 5', short: 'Round 5', tests: 71, lines: 940, ratio: 14.5 },
  { label: 'After closing the gaps', short: 'Gaps closed', tests: 65, lines: 928, ratio: 14.3 },
  { label: 'After the deep trim', short: 'Deep trim', tests: 38, lines: 670, ratio: 10.3 },
]
const scale = 16

export function mountTestsGrowth(root: HTMLElement) {
  root.classList.add('amm', 'amm-tests-growth')
  root.innerHTML = `
    <h3>How the suite grew, then shrank</h3>
    <p class="growth-note">Test code lines for each line of the contract.</p>
    <div class="growth-chart" style="--contract-position: ${100 / scale}%">
      <div class="growth-guide" aria-hidden="true">
        <span></span><div><span class="growth-baseline-label">1× · the contract</span></div><span></span>
      </div>
      <ol class="growth-stages" aria-label="Test-to-contract ratios by stage">
        ${stages.map((stage, i) => `<li class="growth-stage" data-stage="${i}"${i === stages.length - 1 ? ' data-trim' : ''}
          tabindex="0" aria-label="${stage.label}: ${stage.tests} tests, ${stage.lines} code lines, ${stage.ratio.toFixed(1)} times the contract.">
          <span class="growth-label" aria-hidden="true">${stage.short}<small>${stage.tests} tests</small><small>${stage.lines} lines</small></span>
          <span class="growth-track" aria-hidden="true"><span class="growth-bar" style="width: ${stage.ratio / scale * 100}%"></span></span>
          <b aria-hidden="true">${stage.ratio.toFixed(1)}×</b>
        </li>`).join('')}
      </ol>
      <div class="growth-axis" aria-hidden="true"><span></span><div>
        ${[0, 5, 10, 15].map((tick) => `<span style="left: ${tick / scale * 100}%">${tick}×</span>`).join('')}
      </div><span></span></div>
    </div>
    <p class="growth-detail" role="status" aria-live="polite" aria-atomic="true"></p>
    <p class="growth-note">Code lines exclude blanks and comments. Ratios use the contract at each stage. Test counts treat each invariant on each of the invariant run’s pools as a test, so Foundry reports fewer.</p>`

  const detail = root.querySelector<HTMLElement>('.growth-detail')!
  function show(index: number) {
    const stage = stages[index]
    detail.textContent = `${stage.label}: ${stage.tests} tests · ${stage.lines} code lines · ${stage.ratio.toFixed(1)}×.`
  }
  root.querySelectorAll<HTMLElement>('[data-stage]').forEach((row) => {
    row.addEventListener('pointerenter', () => show(Number(row.dataset.stage)))
    row.addEventListener('focus', () => show(Number(row.dataset.stage)))
  })
  show(stages.length - 1)
}
