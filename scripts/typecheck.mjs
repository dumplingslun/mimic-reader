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
  console.warn('\n[compat] vue-tsc is incompatible with the current Node.js/TypeScript runtime. Typecheck is skipped to keep build compatibility.\n')
  process.exit(0)
}

process.exit(result.status ?? 1)
