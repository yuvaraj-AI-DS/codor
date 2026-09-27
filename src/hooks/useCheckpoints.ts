import { useCallback, useEffect, useRef, useState } from 'react'

/** A saved version of ONE file. Versions are keyed by file name. */
export interface Checkpoint {
  id: string
  file: string
  n: number                         // per-file number → "Version n"
  label: string
  createdAt: number
  auto: boolean                     // created by the app (on fix / before restore)
  status: 'ok' | 'error' | 'unknown'
  content: string
}

const DB_NAME = 'rtc'
const DB_VERSION = 2               // v1 stored whole-workspace checkpoints; dropped on upgrade
const STORE = 'versions'
const MAX_PER_FILE = 30

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (db.objectStoreNames.contains('checkpoints')) db.deleteObjectStore('checkpoints')
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => { db.close(); resolve(req ? req.result : undefined) }
    t.onerror = () => { db.close(); reject(t.error) }
  })
}

/** Per-file versions, persisted in IndexedDB (survive refresh). */
export function useCheckpoints() {
  const [all, setAll] = useState<Checkpoint[]>([])   // newest first, every file
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<Checkpoint[]>([])
  listRef.current = all

  useEffect(() => {
    tx<Checkpoint[]>('readonly', s => s.getAll())
      .then(rows => setAll((rows ?? []).sort((a, b) => b.createdAt - a.createdAt)))
      .catch(() => setError('Browser storage is unavailable — versions won’t persist.'))
  }, [])

  const fail = () => setError('Couldn’t write to browser storage.')

  const create = useCallback(async (input: { file: string; content: string; status: Checkpoint['status']; auto: boolean; label?: string }) => {
    const current = listRef.current
    const n = current.filter(c => c.file === input.file).reduce((m, c) => Math.max(m, c.n), 0) + 1
    const cp: Checkpoint = {
      ...input,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      n,
      createdAt: Date.now(),
      label: input.label?.trim() || `Version ${n}`,
    }

    // Cap per file: drop that file's oldest auto versions first, then its oldest manual ones
    let next = [cp, ...current]
    const dropped: string[] = []
    let own = next.filter(c => c.file === cp.file)
    while (own.length > MAX_PER_FILE) {
      const autos = own.filter(c => c.auto && c.id !== cp.id)
      const victim = autos.length ? autos[autos.length - 1] : own[own.length - 1]
      dropped.push(victim.id)
      next = next.filter(c => c.id !== victim.id)
      own = own.filter(c => c.id !== victim.id)
    }

    setAll(next)
    try { await tx('readwrite', s => { s.put(cp); dropped.forEach(id => s.delete(id)) }) } catch { fail() }
    return cp
  }, [])

  const rename = useCallback(async (id: string, label: string) => {
    const trimmed = label.trim()
    const cp = listRef.current.find(c => c.id === id)
    if (!cp || !trimmed || trimmed === cp.label) return
    const updated = { ...cp, label: trimmed }
    setAll(prev => prev.map(c => (c.id === id ? updated : c)))
    try { await tx('readwrite', s => { s.put(updated) }) } catch { fail() }
  }, [])

  const remove = useCallback(async (id: string) => {
    setAll(prev => prev.filter(c => c.id !== id))
    try { await tx('readwrite', s => { s.delete(id) }) } catch { fail() }
  }, [])

  /** Tab renamed → its versions follow the new name. */
  const moveFile = useCallback(async (from: string, to: string) => {
    const moved = listRef.current.filter(c => c.file === from).map(c => ({ ...c, file: to }))
    if (!moved.length) return
    setAll(prev => prev.map(c => (c.file === from ? { ...c, file: to } : c)))
    try { await tx('readwrite', s => { moved.forEach(c => s.put(c)) }) } catch { fail() }
  }, [])

  return { all, create, rename, remove, moveFile, error }
}
