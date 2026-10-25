export interface ParsedBookmark {
  url: string
  title?: string
  addDate?: number
}

export interface ParsedFolder {
  name: string
  folders: ParsedFolder[]
  bookmarks: ParsedBookmark[]
}

const ROOT_FOLDER_NAMES = new Set([
  'bookmarks bar',
  'bookmarks toolbar',
  'favoritos',
  'barra de favoritos',
  'other bookmarks',
  'otros marcadores'
])

function decodeEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos);|&#39;/g, (entity) => {
    switch (entity) {
      case '&amp;': return '&'
      case '&lt;': return '<'
      case '&gt;': return '>'
      case '&quot;': return '"'
      case '&#39;': return "'"
      case '&apos;': return "'"
      default: return entity
    }
  })
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+))/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source)) !== null) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attributes
}

function hasContent(folder: ParsedFolder): boolean {
  return folder.bookmarks.length > 0 || folder.folders.length > 0
}

export function parseNetscapeBookmarks(html: string): ParsedFolder {
  const root: ParsedFolder = { name: '', folders: [], bookmarks: [] }
  if (typeof html !== 'string' || !/<\s*DL\b/i.test(html)) return root

  const stack: ParsedFolder[] = [root]
  const pendingFolders: ParsedFolder[] = []
  const tokens = /<\s*DT\b[^>]*>|<\s*H3\b([^>]*)>([\s\S]*?)<\s*\/\s*H3\s*>|<\s*A\b([^>]*)>([\s\S]*?)<\s*\/\s*A\s*>|<\s*DL\b[^>]*>|<\s*\/\s*DL\s*>/gi
  let match: RegExpExecArray | null

  while ((match = tokens.exec(html)) !== null) {
    const token = match[0]
    if (/^<\s*DT\b/i.test(token)) {
      pendingFolders.length = 0
      continue
    }

    if (/^<\s*H3\b/i.test(token)) {
      const folder: ParsedFolder = {
        name: decodeEntities(match[2].replace(/<[^>]*>/g, '')).trim(),
        folders: [],
        bookmarks: []
      }
      pendingFolders.push(folder)
      continue
    }

    if (/^<\s*A\b/i.test(token)) {
      const attrs = parseAttributes(match[3] ?? '')
      const url = attrs.href
      if (url !== undefined && url.trim() !== '') {
        const bookmark: ParsedBookmark = { url }
        const title = decodeEntities((match[4] ?? '').replace(/<[^>]*>/g, '')).trim()
        if (title) bookmark.title = title
        const addDate = attrs.add_date
        if (addDate !== undefined && /^-?\d+$/.test(addDate.trim())) {
          const parsedDate = Number(addDate)
          if (Number.isSafeInteger(parsedDate)) bookmark.addDate = parsedDate
        }
        stack[stack.length - 1].bookmarks.push(bookmark)
      }
      pendingFolders.length = 0
      continue
    }

    if (/^<\s*DL\b/i.test(token)) {
      const folder = pendingFolders[pendingFolders.length - 1]
      if (folder) {
        stack[stack.length - 1].folders.push(folder)
        stack.push(folder)
      }
      pendingFolders.length = 0
      continue
    }

    if (/^<\s*\/\s*DL\s*>/i.test(token)) {
      if (stack.length > 1) stack.pop()
      pendingFolders.length = 0
    }
  }

  // A folder only exists in the output when it contains bookmarks or non-empty subfolders.
  function prune(folder: ParsedFolder): void {
    for (const child of folder.folders) prune(child)
    folder.folders = folder.folders.filter(hasContent)
  }
  prune(root)

  const firstFolder = root.folders[0]
  if (firstFolder && ROOT_FOLDER_NAMES.has(firstFolder.name.trim().toLowerCase())) {
    root.folders = firstFolder.folders.concat(root.folders.slice(1))
    root.bookmarks = firstFolder.bookmarks.concat(root.bookmarks)
  }

  return root
}
