import fs from 'bare-fs'
import test from 'brittle'
import { handleCreateCollection } from '../src/api/collections.ts'
import { handleImportHtml } from '../src/api/import.ts'
import { deviceAddBookmark } from '../src/device-events.ts'
import { createIdentity } from '../src/identity/store.ts'
import { fromHex, newBookmarkId, resourceIdFromCanonicalUrl } from '../src/ids.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'
import { closeCollectionCore, openExistingCollectionCore, readCollectionEvents } from '../src/storage/collection-core.ts'
import { getCollectionState, getLastProcessedEvent, setLastProcessedEvent } from '../src/storage/materialized-view.ts'
import { createFakeSwarm } from './helpers/fake-swarm.ts'

test('la creación de colección materializa el collection_core y lo reconstruye al reabrir', async (t) => {
  const dataDir = './tmp-test-collection-core-e2e'
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), dataDir }
    await createIdentity(dataDir)
    node = await startNode(config, { swarm: createFakeSwarm() })

    const result = await handleCreateCollection(node, {
      name: 'Colección E2E',
      visibility: 'public',
      language: 'es'
    })
    t.is(result.status, 201, 'la API crea la colección correctamente')

    const collection = [...node.state.collections.values()].find((item) =>
      !item.deleted && item.name === 'Colección E2E'
    )
    t.ok(collection, 'la creación registra la colección en device_core')
    if (!collection) return

    const initialState = await getCollectionState(node.view, collection.collectionId)
    t.ok(initialState?.collection !== null && initialState?.collection !== undefined, 'la vista contiene el génesis')
    t.is(initialState?.collection?.name, 'Colección E2E', 'la vista contiene los metadatos del génesis')
    t.is(initialState?.bookmarks.size, 0, 'la colección nueva no contiene bookmarks iniciales')
    t.is(
      await getLastProcessedEvent(node.view, 'collection:' + collection.collectionId),
      0,
      'la vista registra el índice del génesis'
    )

    const bookmarkId = newBookmarkId()
    const canonicalUrl = 'https://example.com/bookmark-after-genesis'
    await node.apply(deviceAddBookmark({
      authorId: node.identity!.user_id,
      bookmarkId,
      collectionId: collection.collectionId,
      resourceId: resourceIdFromCanonicalUrl(canonicalUrl),
      canonicalUrl,
      title: 'Bookmark posterior',
      tags: [],
      groupId: null
    }))

    t.ok(node.state.bookmarks.has(bookmarkId), 'device_core contiene el bookmark posterior')
    const unchangedState = await getCollectionState(node.view, collection.collectionId)
    t.is(unchangedState?.bookmarks.size, 0, 'la vista de collection_core no incorpora cambios posteriores de device_core')

    // Simulamos un índice desfasado para comprobar el replay del collection_core al arrancar.
    await setLastProcessedEvent(node.view, 'collection:' + collection.collectionId, -1)
    await node.close()
    node = null

    node = await startNode(config, { swarm: createFakeSwarm() })
    const rebuiltState = await getCollectionState(node.view, collection.collectionId)
    t.is(rebuiltState?.collection?.name, 'Colección E2E', 'el reinicio reconstruye los metadatos desde collection_core')
    t.is(rebuiltState?.bookmarks.size, 0, 'el reinicio conserva el estado independiente de collection_core')
    t.is(
      await getLastProcessedEvent(node.view, 'collection:' + collection.collectionId),
      0,
      'el reinicio corrige el índice de sincronización'
    )
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

    const materialized = await getCollectionState(node.view, collection.collectionId)
    t.is(materialized?.collection?.name, 'Viajes', 'la vista materializada contiene los metadatos importados')
    t.is(materialized?.bookmarks.size, 3, 'la vista materializada contiene los tres bookmarks importados')
    t.is(
      await getLastProcessedEvent(node.view, 'collection:' + collection.collectionId),
      3,
      'la vista registra el último evento del collection_core importado'
    )

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
