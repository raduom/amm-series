import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { lines as ch01 } from './src/ch01/lines.ts'
import { excerpts as ch01Properties } from './src/ch01/propertyLines.ts'
import { lines as ch02 } from './src/ch02/lines.ts'
import { marketExcerpts } from './src/ch02/marketLines.ts'
import { excerpts as ch02Properties } from './src/ch02/propertyLines.ts'
import { locate } from './src/source.ts'

const model = (file: string) => fileURLToPath(new URL(`../model/${file}`, import.meta.url))

export default defineConfig({
  base: './',
  // The pages read the Haskell models from ../model.
  server: {
    fs: { allow: ['..'] },
    // Lets the page load through a Cloudflare quick tunnel.
    allowedHosts: ['.trycloudflare.com'],
  },
  plugins: [
    {
      name: 'check-model-lines',
      // Fail early if a line the page points at is no longer in the model.
      buildStart() {
        const read = (file: string) => {
          this.addWatchFile(model(file))
          return readFileSync(model(file), 'utf8')
        }
        locate(read('src/AMM/ConstantSum.hs'), ch01)
        ch01Properties(read('test/AMM/ConstantSumProperties.hs'))
        const product = read('src/AMM/ConstantProduct.hs')
        locate(product, ch02)
        ch02Properties(read('test/AMM/ConstantProductProperties.hs'))
        marketExcerpts(read('test/AMM/MarketPriceProperties.hs'), product)
      },
    },
  ],
})
