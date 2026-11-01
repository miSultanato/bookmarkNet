import fs from 'bare-fs'
import { join } from 'bare-path'
import test from 'brittle'
import { handleCreateCollection } from '../src/api/collections.ts'
import { createBackup, restoreBackup } from '../src/backup/backup.ts'
import {
  deviceAddBookmark,
  deviceAddDevice,
  deviceCreateGroup,
  deviceMoveBookmark
} from '../src/device-events.ts'
import { createIdentity, createIdentityFromMasterKey, identityToApi } from '../src/identity/store.ts'
import { masterKeyToRecoveryPhrase, phraseToMasterKey } from '../src/identity/recovery.ts'
import { fromHex, newBookmarkId, newGroupId, resourceIdFromCanonicalUrl } from '../src/ids.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'
import { readAllEvents } from '../src/storage/device-core.ts'
import { closeCollectionCore, openExistingCollectionCore, readCollectionEvents } from '../src/storage/collection-core.ts'
import { createFakeSwarm } from './helpers/fake-swarm.ts'

const ROOT = './tmp-test-mvp1-e2e'
const BACKUP_PASSWORD = 'mvp1-e2e-backup-password'
const REMOTE_NODE_ID = 'n_0123456789abcdef'
const REMOTE_PUBLIC_KEY = 'ab'.repeat(32)

test('MVP1 E2E: identidad, colección, bookmarks, grupo, dispositivo, backup, restore y recuperación', async (t) => {
  const sourceDir = join(ROOT, 'source')
  const restoredDir = join(ROOT, 'restored')
  const recoveredDir = join(ROOT, 'recovered')
  const sourceConfig = { ...defaultConfig(), dataDir: sourceDir }
  const restoredConfig = { ...defaultConfig(), dataDir: restoredDir }

  let sourceNode: Awaited<ReturnType<typeof startNode>> | null = null
  let restoredNode: Awaited<ReturnType<typeof startNode>> | null = null
  let collectionCore: Awaited<ReturnType<typeof openExistingCollectionCore>> | null = null

  await fs.rm(ROOT, { recursive: true, force: true })

  try {
    const storedIdentity = await createIdentity(sourceDir)
    const originalIdentity = identityToApi(storedIdentity)
    const masterKey = fromHex(storedIdentity.private_key)
    const recoveryPhrase = masterKeyToRecoveryPhrase(masterKey).phrase

    sourceNode = await startNode(sourceConfig, { swarm: createFakeSwarm() })
    t.is(sourceNode.identity?.user_id, originalIdentity.user_id, 'el nodo arranca con la identidad creada')

    const createdCollection = await handleCreateCollection(sourceNode, {
      name: 'Colección MVP1 E2E',
      description: 'Flujo completo de cierre de MVP1',
      visibility: 'public',
      language: 'es'
    })
    t.is(createdCollection.status, 201, 'se crea la colección')

    const collection = [...sourceNode.state.collections.values()].find((item) =>
      !item.deleted && item.name === 'Colección MVP1 E2E'
    )
    t.ok(collection, 'la colección aparece en device_core')
    if (collection === undefined) throw new Error('No se pudo recuperar la colección creada')

    collectionCore = await openExistingCollectionCore(sourceDir, collection.collectionId, masterKey)
    const initialCollectionEvents = await readCollectionEvents(collectionCore)
    t.is(initialCollectionEvents[0]?.event_type, 'collection_genesis', 'collection_core contiene el génesis')
    t.is(
      initialCollectionEvents[0]?.event_type === 'collection_genesis'
        ? initialCollectionEvents[0].payload.visibility
        : null,
      'unlisted',
      'el génesis de la colección se crea como unlisted'
    )
    await closeCollectionCore(collectionCore)
    collectionCore = null

    const firstBookmarkId = newBookmarkId()
    const secondBookmarkId = newBookmarkId()
    const firstUrl = 'https://example.com/mvp1-e2e-first'
    const secondUrl = 'https://example.com/mvp1-e2e-second'

    await sourceNode.apply(deviceAddBookmark({
      authorId: originalIdentity.user_id,
      bookmarkId: firstBookmarkId,
      collectionId: collection.collectionId,
      resourceId: resourceIdFromCanonicalUrl(firstUrl),
      canonicalUrl: firstUrl,
      title: 'Primer bookmark',
      tags: ['e2e'],
      groupId: null
    }))
    await sourceNode.apply(deviceAddBookmark({
      authorId: originalIdentity.user_id,
      bookmarkId: secondBookmarkId,
      collectionId: collection.collectionId,
      resourceId: resourceIdFromCanonicalUrl(secondUrl),
      canonicalUrl: secondUrl,
      title: 'Segundo bookmark',
      tags: ['e2e'],
      groupId: null
    }))

    const groupId = newGroupId()
    await sourceNode.apply(deviceCreateGroup({
      authorId: originalIdentity.user_id,
      groupId,
      collectionId: collection.collectionId,
      name: 'Grupo E2E',
      position: 0
    }))
    await sourceNode.apply(deviceMoveBookmark({
      authorId: originalIdentity.user_id,
      bookmarkId: firstBookmarkId,
      collectionId: collection.collectionId,
      groupId
    }))
    await sourceNode.apply(deviceAddDevice({
      authorId: originalIdentity.user_id,
      nodeId: REMOTE_NODE_ID,
      publicKey: REMOTE_PUBLIC_KEY
    }))

    t.is(sourceNode.state.bookmarks.size, 2, 'device_core contiene los dos bookmarks')
    t.is(sourceNode.state.bookmarks.get(firstBookmarkId)?.groupId, groupId, 'el primer bookmark se mueve al grupo')
    t.is(sourceNode.state.groups.get(groupId)?.name, 'Grupo E2E', 'el grupo queda registrado')
    t.is(sourceNode.state.devices.get(REMOTE_NODE_ID)?.publicKey, REMOTE_PUBLIC_KEY, 'device_core registra el dispositivo añadido')

    collectionCore = await openExistingCollectionCore(sourceDir, collection.collectionId, masterKey)
    const backupCollectionEvents = await readCollectionEvents(collectionCore)
    await closeCollectionCore(collectionCore)
    collectionCore = null

    const backupPath = await createBackup({
      dataDir: sourceDir,
      password: BACKUP_PASSWORD,
      deviceEvents: await readAllEvents(sourceNode.core),
      collectionEvents: new Map([[collection.collectionId, backupCollectionEvents]]),
      collections: [collection.collectionId]
    })
    t.ok(await fs.stat(backupPath).then(() => true, () => false), 'el backup cifrado existe')

    await sourceNode.close()
    sourceNode = null

    await restoreBackup(restoredDir, backupPath, BACKUP_PASSWORD, 'all')
    const restoredDevices = JSON.parse(await fs.readFile(join(restoredDir, 'devices.json'), 'utf8')) as string[]
    t.alike(restoredDevices, [REMOTE_NODE_ID], 'el backup conserva la lista de dispositivos')

    restoredNode = await startNode(restoredConfig, { swarm: createFakeSwarm() })
    t.is(restoredNode.identity?.user_id, originalIdentity.user_id, 'se restaura la misma identidad')
    t.is(restoredNode.identity?.public_key, originalIdentity.public_key, 'se restaura la misma clave pública')

    const restoredCollection = restoredNode.state.collections.get(collection.collectionId)
    t.ok(restoredCollection !== undefined && !restoredCollection.deleted, 'la colección se restaura en device_core')
    t.is(restoredNode.state.bookmarks.size, 2, 'se restauran los dos bookmarks')
    t.is(restoredNode.state.groups.get(groupId)?.name, 'Grupo E2E', 'se restaura el grupo')
    t.is(restoredNode.state.bookmarks.get(firstBookmarkId)?.groupId, groupId, 'se conserva el bookmark dentro del grupo')
    t.is(restoredNode.state.devices.get(REMOTE_NODE_ID)?.publicKey, REMOTE_PUBLIC_KEY, 'se restaura el dispositivo conocido')

    collectionCore = await openExistingCollectionCore(restoredDir, collection.collectionId, masterKey)
    const restoredCollectionEvents = await readCollectionEvents(collectionCore)
    t.is(restoredCollectionEvents[0]?.event_type, 'collection_genesis', 'collection_core restaurado conserva el génesis')
    t.is(
      restoredCollectionEvents[0]?.event_type === 'collection_genesis'
        ? restoredCollectionEvents[0].payload.visibility
        : null,
      'unlisted',
      'el génesis restaurado mantiene visibility unlisted'
    )
    await closeCollectionCore(collectionCore)
    collectionCore = null

    await restoredNode.close()
    restoredNode = null

    const recoveredMasterKey = phraseToMasterKey(recoveryPhrase)
    const recoveredIdentity = await createIdentityFromMasterKey(recoveredDir, recoveredMasterKey)
    const recoveredApiIdentity = identityToApi(recoveredIdentity)
    t.is(recoveredApiIdentity.user_id, originalIdentity.user_id, 'la frase recupera el mismo user_id')
    t.is(recoveredApiIdentity.public_key, originalIdentity.public_key, 'la frase recupera la misma public_key')
  } finally {
    if (collectionCore !== null) await closeCollectionCore(collectionCore)
    if (restoredNode !== null) await restoredNode.close()
    if (sourceNode !== null) await sourceNode.close()
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})
