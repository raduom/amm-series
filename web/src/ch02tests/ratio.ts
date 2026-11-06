import { escape } from '../code'
import '../widget.css'
import './ratio.css'

const contractLines = 65
const parts = [
  {
    key: 'fixtures', short: 'Fixtures', label: 'Fixtures and helpers', lines: 223,
    description: 'Set up pools and tokens, fund traders, approve payments, and keep the expected balances for the checks.',
    file: 'ConstantProductPool.t.sol', from: 53, to: 55,
    excerpt: '        tokenIn.mint(trader, amountIn + spare);\n        vm.prank(trader);\n        tokenIn.approve(address(pool), amountIn + spare);',
  },
  {
    key: 'model', short: 'Model', label: 'The model’s worked examples and properties', lines: 158,
    description: 'Copy the model’s worked trades and rules into Solidity, so the contract can be checked against their answers.',
    file: 'ConstantProductPool.t.sol', from: 165, to: 167,
    excerpt: '        stock(1000, 4000);\n        assertEq(trade(true, 100, 0), 363);\n        assertReserves(1100, 3637);',
  },
  {
    key: 'invariant', short: 'Invariant', label: 'The invariant run', lines: 147,
    description: 'Have random traders make sequences of calls, checking payments, balances, events, and the reserve product along the way.',
    file: 'ConstantProductPool.invariant.t.sol', from: 156, to: 158,
    excerpt: '        uint256 product = pool.reserve0() * pool.reserve1();\n        if (product < lastProduct) productDecreased = true;\n        lastProduct = product;',
  },
  {
    key: 'specific', short: 'Specific', label: 'Contract-specific tests', lines: 142,
    description: 'Check what only the contract has: initialization, an owner, token decimals, donations, events, and integer overflow.',
    file: 'ConstantProductPool.t.sol', from: 424, to: 426,
    excerpt: '        vm.prank(address(type(uint160).max));\n        vm.expectRevert(ConstantProductPool.NotOwner.selector);\n        pool.initialize(1000, 1000);',
  },
]
const totalLines = parts.reduce((sum, part) => sum + part.lines, 0)
const ratio = (lines: number) => `${(lines / contractLines).toFixed(1)}×`

export function mountTestsRatio(root: HTMLElement) {
  const included = parts.map(() => true)
  let selected = 0

  root.classList.add('amm', 'amm-tests-ratio')
  root.innerHTML = `
    <h3>The ratio, part by part</h3>
    <div class="ratio-summary" role="status" aria-live="polite" aria-atomic="true">
      <p class="ratio-total"></p>
      <p class="ratio-note" data-accounting hidden>This is an accounting exercise, not a measured suite.</p>
    </div>
    <div class="ratio-chart" role="group" aria-label="Test lines and contract lines, on the same scale">
      <p class="ratio-chart-label">Tests <span data-test-lines></span></p>
      <div class="ratio-track ratio-stack">${parts.map((part, i) => `
        <button type="button" class="ratio-band" data-part="${part.key}" data-select="${i}"
          style="width: ${part.lines / totalLines * 100}%" aria-pressed="${i === selected}"
          aria-label="${escape(part.label)}: ${part.lines} lines, ${ratio(part.lines)} the contract. Show excerpt.">
          <span>${part.short}</span><b>${part.lines}<span class="ratio-band-x"> · ${ratio(part.lines)}</span></b>
        </button>`).join('')}</div>
      <p class="ratio-chart-label">The contract <span>65 lines · 1.0×</span></p>
      <div class="ratio-track" aria-hidden="true">
        <div class="ratio-contract" style="width: ${contractLines / totalLines * 100}%"></div>
      </div>
    </div>
    <fieldset class="ratio-parts">
      <legend>Select a part to read it; switch it off to subtract it.</legend>
      ${parts.map((part, i) => `<div class="ratio-part" data-part="${part.key}">
        <button type="button" class="ratio-select" data-select="${i}" aria-pressed="${i === selected}">
          <i aria-hidden="true"></i><span>${escape(part.label)}</span>
        </button>
        <label class="ratio-toggle">
          <input type="checkbox" role="switch" data-include="${i}" checked aria-label="Include ${escape(part.label)}">
          <span data-inclusion="${i}">On</span>
        </label>
      </div>`).join('')}
    </fieldset>
    <section class="ratio-detail" aria-label="Selected part" aria-live="polite" aria-atomic="true"></section>
    <p class="ratio-note ratio-footnote">Code lines, excluding blanks and comments.</p>`

  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!

  function renderTotal() {
    const total = parts.reduce((sum, part, i) => sum + (included[i] ? part.lines : 0), 0)
    $('.ratio-total').innerHTML = `<b>${total} lines</b> <span>÷ ${contractLines} =</span> <b>${ratio(total)}</b>`
    $('[data-test-lines]').textContent = `${total} lines`
    // Only the model checks are a stand-in; without them the rest is accounting, not a measured suite.
    $('[data-accounting]').hidden = included[parts.findIndex((part) => part.key === 'model')]
    parts.forEach((_, i) => {
      $(`[data-select="${i}"].ratio-band`).hidden = !included[i]
      $(`[data-inclusion="${i}"]`).textContent = included[i] ? 'On' : 'Off'
    })
  }

  function renderDetail() {
    const part = parts[selected]
    root.querySelectorAll<HTMLButtonElement>('[data-select]').forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.select) === selected))
    })
    $('.ratio-detail').innerHTML = `
      <h4>${escape(part.label)}</h4>
      <p class="ratio-detail-count">${part.lines} lines · ${ratio(part.lines)} the contract</p>
      <p>${part.description}</p>
      <pre><code>${escape(part.excerpt)}</code></pre>
      <p class="ratio-source">evm/test/${part.file}:${part.from}–${part.to} · ch02-evm</p>`
  }

  root.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-select]')
    if (!button || !root.contains(button)) return
    selected = Number(button.dataset.select)
    renderDetail()
  })
  root.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement
    if (!input.matches('input[data-include]')) return
    included[Number(input.dataset.include)] = input.checked
    renderTotal()
  })

  renderTotal()
  renderDetail()
}
