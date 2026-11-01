import { deviceAddBookmark, deviceCreateCollection, deviceCreateGroup } from '../device-events.ts'
import { canonicalizeUrl } from '../canonicalize.ts'
import { fromHex, newBookmarkId, newGroupId, resourceIdFromCanonicalUrl } from '../ids.ts'
import { collectionIdFromPublicKey, deriveCollectionKeypair } from '../keys.ts'
import { userKeypairFromMasterKey } from '../identity.ts'
import { closeCollectionCore, createCollectionCore } from '../storage/collection-core.ts'
import { loadIdentity } from '../identity/store.ts'
import type { ParsedBookmark, ParsedFolder } from '../import/netscape.ts'
import { parseNetscapeBookmarks } from '../import/netscape.ts'
import { ulid } from '../ulid.ts'
import type { Node } from '../node/start.ts'

interface ImportError {
  url: string
  reason: string
}

interface ImportSummary {
  imported: { collections: number; groups: number; bookmarks: number }
  skipped: number
  errors: ImportError[]
}

function error(status: number, code: string, message: string): { status: number; body: unknown } {
  return { status, body: { error: { code, message } } }
}

/** Returns base when free, otherwise the first available "(importado N)" suffix. */
function findFreeName(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base
  let suffix = ' (importado)'
  if (!existing.has(base + suffix)) return base + suffix
  for (let number = 2; ; number++) {
    suffix = ' (importado ' + number + ')'
    if (!existing.has(base + suffix)) return base + suffix
  }
}

export async function handleImportHtml(
  node: Node,
  body: { html: string }
): Promise<{ status: number; body: unknown }> {
  if (node.identity === null) return error(401, 'NO_IDENTITY', 'Crea o importa una identidad antes de importar')
  if (body === null || typeof body !== 'object' || typeof body.html !== 'string' || body.html.trim().length === 0) {
    return error(400, 'INVALID_HTML', 'html debe ser un string no vacío')
  }

  const tree = parseNetscapeBookmarks(body.html)
  const summary: ImportSummary = {
    imported: { collections: 0, groups: 0, bookmarks: 0 },
    skipped: 0,
    errors: []
  }
  const authorId = node.identity.user_id
  const storedIdentity = await loadIdentity(node.config.dataDir)
  if (storedIdentity === null) {
    return error(500, 'IDENTITY_NOT_FOUND', 'No se pudo cargar la identidad local para importar colecciones')
  }
  const masterKey = fromHex(storedIdentity.private_key)

  async function importBookmark(bookmark: ParsedBookmark, collectionId: string | null, groupId: string | null): Promise<void> {
    let canonicalUrl: string
    try {
      canonicalUrl = canonicalizeUrl(bookmark.url)
    } catch {
      summary.skipped++
      summary.errors.push({ url: bookmark.url, reason: 'invalid URL' })
      return
    }

    try {
      await node.apply(deviceAddBookmark({
        authorId,
        bookmarkId: newBookmarkId(),
        collectionId,
        resourceId: resourceIdFromCanonicalUrl(canonicalUrl),
        canonicalUrl,
        title: bookmark.title || bookmark.url,
        tags: [],
        groupId
      }))
      summary.imported.bookmarks++
    } catch (cause) {
      summary.skipped++
      summary.errors.push({
        url: bookmark.url,
        reason: cause instanceof Error ? cause.message : 'failed to import bookmark'
      })
    }
  }

  for (const bookmark of tree.bookmarks) {
    await importBookmark(bookmark, null, null)
  }

  for (const folder of tree.folders) {
    const existingCollectionNames = new Set(
      [...node.state.collections.values()]
        .filter((collection) => !collection.deleted)
        .map((collection) => collection.name)
    )
    const collectionName = findFreeName(folder.name, existingCollectionNames)
    const collectionId = ulid()
    const collectionKeypair = deriveCollectionKeypair(masterKey, collectionId)
    const publicCollectionId = collectionIdFromPublicKey(collectionKeypair.publicKey)
    await node.apply(deviceCreateCollection({
      authorId,
      collectionId,
      publicCollectionId,
      name: collectionName,
      visibility: 'public'
    }))
    summary.imported.collections++

    for (const bookmark of folder.bookmarks) {
      await importBookmark(bookmark, collectionId, null)
    }

    const existingGroupNames = new Set(
      [...node.state.groups.values()]
        .filter((group) => !group.deleted && group.collectionId === collectionId)
        .map((group) => group.name)
    )

    async function importSubfolder(subfolder: ParsedFolder, parentPath: string): Promise<void> {
      const fullName = parentPath ? parentPath + '/' + subfolder.name : subfolder.name
      const groupName = findFreeName(fullName, existingGroupNames)
      const groupId = newGroupId()
      const position = [...node.state.groups.values()]
        .filter((group) => !group.deleted && group.collectionId === collectionId).length
      await node.apply(deviceCreateGroup({
        authorId,
        groupId,
        collectionId,
        name: groupName,
        position
      }))
      existingGroupNames.add(groupName)
      summary.imported.groups++

      for (const bookmark of subfolder.bookmarks) {
        await importBookmark(bookmark, collectionId, groupId)
      }
      for (const child of subfolder.folders) {
        await importSubfolder(child, fullName)
      }
    }

    for (const subfolder of folder.folders) {
      await importSubfolder(subfolder, '')
    }

    // El evento de colección debe existir antes de añadir bookmarks, porque
    // device_add_bookmark valida que su collectionId esté activo. El core se
    // crea al terminar la importación para proyectar el estado completo.
    let collectionCore: Awaited<ReturnType<typeof createCollectionCore>> | null = null
    try {
      const authorKeypair = userKeypairFromMasterKey(masterKey)
      collectionCore = await createCollectionCore(
        node.config.dataDir,
        collectionId,
        masterKey,
        authorId,
        authorKeypair.publicKey,
        authorKeypair.secretKey,
        node.state
      )
      await closeCollectionCore(collectionCore)
      collectionCore = null
    } catch (cause) {
      if (collectionCore !== null) {
        try {
          await closeCollectionCore(collectionCore)
        } catch (closeError) {
          console.error('No se pudo cerrar el collection_core tras un error:', closeError)
        }
      }
      console.error('No se pudo crear el collection_core de la colección importada ' + collectionId + ':', cause)
      return error(
        500,
        'COLLECTION_CORE_CREATION_FAILED',
        'La colección se importó localmente, pero no se pudo crear su collection_core. Se volverá a intentar al arrancar el nodo.'
      )
    }
  }

  return { status: 200, body: summary }
}
