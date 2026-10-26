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
    const relativePath = path.posix.join(relativeDirectory, name)
    const stat = fs.statSync(absolutePath)
    if (stat.isDirectory()) {
      walk(absolutePath, relativePath)
      continue
    }
    if (!stat.isFile() || !allowedExtensions.has(path.extname(name).toLowerCase())) continue
    entries.push({
      key: relativePath.split(path.sep).join('/'),
      source: 'src/ui/' + relativePath.split(path.sep).join('/')
    })
  }
}

walk(uiDir)

const lines = [
  '// Generado automáticamente por scripts/generate-assets.js. No editar.',
  'export const assets = {',
  ...entries.map(({ key, source }) => `  '${key}': import.meta.asset('${source}'),`),
  '}',
  ''
]

fs.writeFileSync(outputPath, lines.join('\n'))
