import { openDB, type IDBPDatabase } from 'idb'
import { useEditor } from './editor'
import type { ProjectSnapshot } from '@/types'

const DB_NAME = 'subtitler'
const STORE = 'project'
const KEY = 'current'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE)
        }
      },
    })
  }
  return dbPromise
}

let saveTimer: number | null = null
let lastFailedAt = 0
let saveListener: ((status: 'idle' | 'saving' | 'error') => void) | null = null
let lastError: string | null = null

export function onSaveStatus(cb: typeof saveListener) {
  saveListener = cb
}

export function getLastError() {
  return lastError
}

async function writeSnapshot(snap: ProjectSnapshot) {
  saveListener?.('saving')
  try {
    const db = await getDB()
    await db.put(STORE, snap, KEY)
    lastError = null
    saveListener?.('idle')
  } catch (e) {
    lastError = e instanceof Error ? e.message : 'IndexedDB write failed'
    lastFailedAt = Date.now()
    saveListener?.('error')
    console.error('IndexedDB save failed:', e)
  }
}

export function schedulePersistedSave() {
  if (saveTimer != null) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    saveTimer = null
    const snap = useEditor.getState().toSnapshot()
    void writeSnapshot(snap)
  }, 500)
}

export async function loadSnapshot(): Promise<ProjectSnapshot | null> {
  try {
    const db = await getDB()
    return (await db.get(STORE, KEY)) ?? null
  } catch (e) {
    console.error('IndexedDB load failed:', e)
    return null
  }
}

export async function clearSnapshot() {
  try {
    const db = await getDB()
    await db.delete(STORE, KEY)
  } catch (e) {
    console.error('IndexedDB clear failed:', e)
  }
}

export function startAutosave() {
  return useEditor.subscribe(
    (s) => [s.videoBlob, s.videoMeta, s.subtitles, s.style, s.watermark, s.customFonts] as const,
    () => {
      const st = useEditor.getState()
      if (!st.videoBlob) return
      schedulePersistedSave()
    },
    { equalityFn: shallowArrayEq },
  )
}

function shallowArrayEq(a: readonly unknown[], b: readonly unknown[]) {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

export { lastFailedAt }
