import { spawn } from 'node:child_process'

function run(cmd, args) {
  const child = spawn(cmd, args, { stdio: 'inherit' })
  child.on('exit', (code) => {
    if (code) process.exit(code)
  })
  return child
}

run('node', ['server/index.js'])
run('npx', ['vite', '--host', '0.0.0.0', '--port', '5173'])
