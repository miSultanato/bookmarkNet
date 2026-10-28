import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const uiDir = path.join(repoRoot, 'src/ui')
const outputPath = path.join(uiDir, 'assets.generated.js')
const allowedExtensions = new Set(['.html', '.js', '.css', '.svg', '.png', '.ico', '.json'])
const binaryExtensions = new Set(['.png', '.ico'])
const entries = {}

function walk(directory, relativeDirectory = '') {
  for (const name of fs.readdirSync(directory).sort()) {
    const absolutePath = path.join(directory, name)
    if (absolutePath === outputPath) continue

    const relativePath = path.posix.join(relativeDirectory, name)
    const stat = fs.statSync(absolutePath)
    if (stat.isDirectory()) {
      walk(absolutePath, relativePath)
      continue
    }

    const extension = path.extname(name).toLowerCase()
    if (!stat.isFile() || !allowedExtensions.has(extension)) continue

    const normalizedPath = relativePath.split(path.sep).join('/')
    const data = fs.readFileSync(absolutePath)
    entries[normalizedPath] = binaryExtensions.has(extension)
      ? data.toString('base64')
      : data.toString('utf8')
  }
}

walk(uiDir)

const output = [
  '// Generado automáticamente por scripts/generate-assets.js. No editar.',
  '// Los assets binarios PNG e ICO se almacenan en base64.',
  'export const assets = ' + JSON.stringify(entries, null, 2),
  ''
].join('\n')

fs.writeFileSync(outputPath, output)
