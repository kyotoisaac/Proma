#!/usr/bin/env node
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const electronDist = path.resolve(root, '../../node_modules/electron/dist')

// 1. Build
console.log('[1/5] Building...')
execSync('npx vite build', { cwd: root, stdio: 'inherit' })
execSync('npx esbuild src/main/index.ts --bundle --platform=node --format=cjs --outfile=dist/main.cjs --external:electron --external:@anthropic-ai/claude-agent-sdk', { cwd: root, stdio: 'inherit' })
execSync('npx esbuild src/preload/index.ts --bundle --platform=node --format=cjs --outfile=dist/preload.cjs --external:electron', { cwd: root, stdio: 'inherit' })
execSync('cp -r resources dist/ 2>/dev/null || true', { cwd: root, shell: true })

// 2. Fix package.json main entry for asar
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
pkg.main = 'main.cjs'
fs.writeFileSync(path.join(root, 'dist/package.json'), JSON.stringify(pkg, null, 2))

// 3. Create win-unpacked
console.log('[2/5] Creating win-unpacked...')
const out = path.join(root, 'out/win-unpacked')
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })

for (const f of fs.readdirSync(electronDist)) {
  const src = path.join(electronDist, f)
  const dst = path.join(out, f)
  const st = fs.statSync(src)
  if (st.isFile()) fs.copyFileSync(src, dst)
  else if (f === 'locales') fs.cpSync(src, dst, { recursive: true })
}
fs.renameSync(path.join(out, 'electron.exe'), path.join(out, '培立智云.exe'))
fs.writeFileSync(path.join(out, 'package.json'), JSON.stringify({ main: 'resources/app.asar' }))

// 4. Pack asar
console.log('[3/5] Packing asar...')
fs.mkdirSync(path.join(out, 'resources'), { recursive: true })
execSync(`npx asar pack dist/ "${path.join(out, 'resources/app.asar')}"`, { cwd: root, stdio: 'inherit' })

// Copy default-skills
fs.cpSync(path.join(root, 'default-skills'), path.join(out, 'resources/default-skills'), { recursive: true })

// Copy SDK
const sdkRoot = path.resolve(root, '../../node_modules/@anthropic-ai')
fs.cpSync(sdkRoot, path.join(out, 'node_modules/@anthropic-ai'), { recursive: true })

// 5. Copy workspace files
console.log('[4/5] Copying workspace files...')
const wsDir = path.join(out, '工作区文件')
fs.mkdirSync(path.join(wsDir, '课程标准'), { recursive: true })
fs.mkdirSync(path.join(wsDir, '设计原则/论文原文'), { recursive: true })

const home = process.env.HOME || process.env.USERPROFILE
const devWs = path.join(home, '.proma-dev/agent-workspaces/default/workspace-files')
const prodWs = path.join(home, '.proma/agent-workspaces/default/workspace-files')

for (const wsPath of [devWs, prodWs]) {
  if (fs.existsSync(path.join(wsPath, '课程标准'))) {
    fs.cpSync(path.join(wsPath, '课程标准'), path.join(wsDir, '课程标准'), { recursive: true })
  }
  if (fs.existsSync(path.join(wsPath, '设计原则'))) {
    fs.cpSync(path.join(wsPath, '设计原则'), path.join(wsDir, '设计原则'), { recursive: true })
  }
}

console.log(`[5/5] Done! ${out}`)
