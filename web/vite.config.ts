import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { lines as ch01 } from './src/ch01/lines.ts'
import { excerpts as ch01Properties } from './src/ch01/propertyLines.ts'
import { locate } from './src/source.ts'

const model = (file: string) => fileURLToPath(new URL(`../model/${file}`, import.meta.url))

export default defineConfig({
  base: './',
  // The pages read the Haskell models from ../model.
  server: { fs: { allow: ['..'] } },
  plugins: [
    {
      name: 'check-model-lines',
      // Fail early if a line the page points at is no longer in the model.
      buildStart() {
        const swap = model('src/AMM/ConstantSum.hs')
        const properties = model('test/AMM/ConstantSumProperties.hs')
        this.addWatchFile(swap)
        this.addWatchFile(properties)
        locate(readFileSync(swap, 'utf8'), ch01)
        ch01Properties(readFileSync(properties, 'utf8'))
      },
    },
  ],
})
