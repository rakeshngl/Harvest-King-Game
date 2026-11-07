import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function forwardSignals(children, on = process.on.bind(process), exit = process.exit.bind(process)) {
  const gate = { shutting: false }
  function shutdown(signal) {
    if (gate.shutting) return
    gate.shutting = true
    const live = children.filter((c) => c.exitCode == null && c.signalCode == null)
    if (!live.length) {
      exit(0)
      return
    }
    let left = live.length
    for (const child of live) {
      child.once('exit', () => {
        left -= 1
        if (!left) exit(0)
      })
      child.kill(signal)
    }
  }
  on('SIGTERM', () => shutdown('SIGTERM'))
  on('SIGINT', () => shutdown('SIGINT'))
  return gate
}

export function startDev({ spawnFn = spawn, on = process.on.bind(process), exit = process.exit.bind(process) } = {}) {
  const children = []
  const gate = forwardSignals(children, on, exit)
  function run(cmd, args) {
    const child = spawnFn(cmd, args, { stdio: 'inherit' })
    children.push(child)
    child.on('exit', (code) => {
      if (gate.shutting) return
      if (code) exit(code)
    })
    return child
  }
  run('node', ['server/index.js'])
  run('npx', ['vite', '--host', '0.0.0.0', '--port', '5173'])
  return { children, gate }
}

const here = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === here) startDev()
