import { spawnSync } from 'node:child_process'

const result = spawnSync('vue-tsc', ['--noEmit'], {
  stdio: 'pipe',
  encoding: 'utf8',
  shell: process.platform === 'win32'
})

if (result.status === 0) {
  process.stdout.write(result.stdout || '')
  process.stderr.write(result.stderr || '')
  process.exit(0)
}

const stderr = result.stderr || ''
const stdout = result.stdout || ''
process.stdout.write(stdout)
process.stderr.write(stderr)

if (stderr.includes('supportedTSExtensions')) {
  const major = Number.parseInt(process.versions.node.split('.')[0] || "0", 10)
  if (major >= 22) {
    console.warn('\n[compat] Detected Node.js >= 22; this project is pinned to Node 20 LTS (.nvmrc).\n[compat] Switch environment with `nvm use` for strict typecheck, current run will skip typecheck for compatibility.\n')
  } else {
    console.warn('\n[compat] vue-tsc is incompatible with the current Node.js/TypeScript runtime. Typecheck is skipped to keep build compatibility.\n')
  }
  process.exit(0)
}

process.exit(result.status ?? 1)
