import fs from 'bare-fs'
import test from 'brittle'
import { handleImportHtml } from '../src/api/import.ts'
import { deviceAddBookmark, deviceCreateCollection } from '../src/device-events.ts'
import { userKeypairFromMasterKey } from '../src/identity.ts'
import { createIdentity } from '../src/identity/store.ts'
import { fromHex, newBookmarkId, resourceIdFromCanonicalUrl } from '../src/ids.ts'
import { collectionIdFromPublicKey, deriveCollectionKeypair } from '../src/keys.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'
import {
  closeCollectionCore,
  createCollectionCore,
  openExistingCollectionCore,
  readCollectionEvents
} from '../src/storage/collection-core.ts'
import { createFakeSwarm } from './helpers/fake-swarm.ts'

test('collection_core conserva el génesis y no recibe cambios posteriores en MVP1', async (t) => {
  const dataDir = './tmp-test-collection-core-e2e'
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), dataDir }
    const storedIdentity = await createIdentity(dataDir)
    const masterKey = fromHex(storedIdentity.private_key)
    const authorKeypair = userKeypairFromMasterKey(masterKey)
    node = await startNode(config, { swarm: createFakeSwarm() })

    const collectionUuid = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
    const collectionKeypair = deriveCollectionKeypair(masterKey, collectionUuid)
    await node.apply(deviceCreateCollection({
      authorId: node.identity!.user_id,
      collectionId: collectionUuid,
      publicCollectionId: collectionIdFromPublicKey(collectionKeypair.publicKey),
      name: 'Colección E2E',
      visibility: 'public',
      language: 'es'
    }))

    // Se crea el core después del evento de colección y antes del bookmark.
    let collectionCore = await createCollectionCore(
      dataDir,
      collectionUuid,
      masterKey,
      node.identity!.user_id,
      authorKeypair.publicKey,
      authorKeypair.secretKey,
      node.state
    )
    await closeCollectionCore(collectionCore)

    collectionCore = await openExistingCollectionCore(dataDir, collectionUuid, masterKey)
    const initialEvents = await readCollectionEvents(collectionCore)
    const initialLength = collectionCore.length
    const initialGenesis = JSON.stringify(initialEvents[0])
    t.is(initialEvents[0]?.event_type, 'collection_genesis', 'el primer bloque es el génesis')
    t.is(
      initialEvents[0]?.event_type === 'collection_genesis' ? initialEvents[0].payload.visibility : null,
      'unlisted',
      'el génesis de la colección no publicada tiene visibility unlisted'
    )
    t.is(initialLength, 1, 'el core recién creado contiene únicamente el génesis')
    await closeCollectionCore(collectionCore)

    const bookmarkId = newBookmarkId()
    const canonicalUrl = 'https://example.com/bookmark-after-genesis'
    await node.apply(deviceAddBookmark({
      authorId: node.identity!.user_id,
      bookmarkId,
      collectionId: collectionUuid,
      resourceId: resourceIdFromCanonicalUrl(canonicalUrl),
      canonicalUrl,
      title: 'Bookmark posterior',
      tags: [],
      groupId: null
    }))

    t.ok(node.state.bookmarks.has(bookmarkId), 'device_core contiene el bookmark posterior')
    collectionCore = await openExistingCollectionCore(dataDir, collectionUuid, masterKey)
    const eventsAfterBookmark = await readCollectionEvents(collectionCore)
    t.is(collectionCore.length, initialLength, 'el bookmark posterior no añade bloques al collection_core')
    t.is(
      eventsAfterBookmark.some((event) => event.event_type === 'add_bookmark' &&
        event.payload.bookmarkId === bookmarkId),
      false,
      'el bookmark posterior no aparece en collection_core durante MVP1'
    )
    await closeCollectionCore(collectionCore)

    await node.close()
    node = null
    node = await startNode(config, { swarm: createFakeSwarm() })

    t.ok(node.state.bookmarks.has(bookmarkId), 'device_core conserva el bookmark tras reabrir el nodo')
    collectionCore = await openExistingCollectionCore(dataDir, collectionUuid, masterKey)
    const reopenedEvents = await readCollectionEvents(collectionCore)
    t.is(collectionCore.length, initialLength, 'la reapertura no cambia la longitud del collection_core')
    t.is(JSON.stringify(reopenedEvents[0]), initialGenesis, 'la reapertura conserva el contenido exacto del génesis')
    t.is(
      reopenedEvents.some((event) => event.event_type === 'add_bookmark' &&
        event.payload.bookmarkId === bookmarkId),
      false,
      'el bookmark posterior sigue ausente del collection_core'
    )
    await closeCollectionCore(collectionCore)
  } finally {
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('la importación HTML crea collection_core con los bookmarks iniciales', async (t) => {
  const dataDir = './tmp-test-collection-core-e2e-import'
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), dataDir }
    const storedIdentity = await createIdentity(dataDir)
    node = await startNode(config, { swarm: createFakeSwarm() })

    const html = '<DL><p><DT><H3>Viajes</H3><DL><p>' +
      '<DT><A HREF="https://example.com/paris">París</A>' +
      '<DT><A HREF="https://example.com/rome">Roma</A>' +
      '<DT><A HREF="https://example.com/tokyo">Tokio</A>' +
      '</DL></DL>'
    const result = await handleImportHtml(node, { html })
    t.is(result.status, 200, 'la importación HTML termina correctamente')

    const collection = [...node.state.collections.values()].find((item) =>
      !item.deleted && item.name === 'Viajes'
    )
    t.ok(collection, 'la importación crea la colección')
    if (!collection) return

    const collectionCore = await openExistingCollectionCore(
      dataDir,
      collection.collectionId,
      fromHex(storedIdentity.private_key)
    )
    try {
      const events = await readCollectionEvents(collectionCore)
      const genesis = events[0]
      const bookmarkEvents = events.filter((event) => event.event_type === 'add_bookmark')
      t.is(genesis?.event_type, 'collection_genesis', 'el core contiene el génesis')
      t.is(
        genesis?.event_type === 'collection_genesis' ? genesis.payload.visibility : null,
        'unlisted',
        'el génesis importado tiene visibility unlisted'
      )
      t.is(bookmarkEvents.length, 3, 'el core contiene los tres bookmarks importados')
      t.is(
        bookmarkEvents.map((event) => event.event_type === 'add_bookmark' ? event.payload.title : '').sort().join(','),
        'París,Roma,Tokio',
        'el core contiene los títulos de los bookmarks importados'
      )
    } finally {
      await closeCollectionCore(collectionCore)
    }
  } finally {
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
