import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

function officeOxideWasm(): Plugin {
  return {
    name: 'office-oxide-wasm-asset',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'office_oxide_bg.wasm',
        source: readFileSync(resolve('node_modules/office-oxide-wasm/node/office_oxide_bg.wasm'))
      })
    }
  }
}

export default defineConfig({
  main: {
    plugins: [officeOxideWasm(), externalizeDepsPlugin({ exclude: ['office-oxide-wasm'] })],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
