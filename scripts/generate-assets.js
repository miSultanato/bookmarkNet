import fs from 'node:fs'
import path from 'node:path'

const uiDir = path.resolve('src/ui')
const outputPath = path.join(uiDir, 'assets.generated.js')
const allowedExtensions = new Set(['.html', '.js', '.css', '.svg', '.png', '.ico', '.json'])
const entries = []

function walk(directory, relativeDirectory = '') {
  let names
  try {
    names = fs.readdirSync(directory).sort()
  } catch (error) {
    if (error.code === 'ENOENT' && directory === path.join(uiDir, 'assets')) return
    throw error
  }

  for (const name of names) {
    const absolutePath = path.join(directory, name)
    if (absolutePath === outputPath) continue
    const relativePath = path.posix.join(relativeDirectory, name)
    const stat = fs.statSync(absolutePath)
    if (stat.isDirectory()) {
      walk(absolutePath, relativePath)
      continue
    }
    if (!stat.isFile() || !allowedExtensions.has(path.extname(name).toLowerCase())) continue
    const normalizedPath = relativePath.split(path.sep).join('/')
    entries.push({
      key: normalizedPath,
      asset: './' + normalizedPath,
      source: 'src/ui/' + normalizedPath
    })
  }
}

walk(uiDir)

const lines = [
  '// Generado automáticamente por scripts/generate-assets.js. No editar.',
  'export const assets = {',
  ...entries.map(({ key, asset, source }) => `  '${key}': (() => { try { const resolved = import.meta.asset('${asset}'); return typeof resolved === 'string' && resolved && resolved !== '${asset}' && !resolved.startsWith('file:') && !resolved.startsWith('/') && !resolved.startsWith('src/ui/') ? resolved : '${source}' } catch { return '${source}' } })(),`),
  '}',
  ''
]

fs.writeFileSync(outputPath, lines.join('\n'))
