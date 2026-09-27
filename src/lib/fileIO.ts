// Browser-side file helpers. No backend, no extra dependencies.

type SavePicker = (opts: {
  suggestedName?: string
  types?: Array<{ description: string; accept: Record<string, string[]> }>
}) => Promise<FileSystemFileHandle>

const PY_TYPES = [{ description: 'Python file', accept: { 'text/x-python': ['.py'] } }]

/** True on Chrome/Edge. False on Brave (API disabled by default), Firefox and Safari. */
export function canPickSaveLocation(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window
}

/** Opens the OS save dialog. Returns null if the user cancels. */
export async function pickSaveHandle(suggestedName: string): Promise<FileSystemFileHandle | null> {
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker
  if (!picker) return null
  try {
    return await picker({ suggestedName, types: PY_TYPES })
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return null
    throw e
  }
}

export async function writeToHandle(handle: FileSystemFileHandle, content: string): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(content: string, filename: string): void {
  downloadBlob(new Blob([content], { type: 'text/x-python;charset=utf-8' }), filename)
}

export function ensurePy(name: string): string {
  const trimmed = name.trim().replace(/[\\/:*?"<>|]/g, '_')
  if (!trimmed) return 'untitled.py'
  return trimmed.toLowerCase().endsWith('.py') ? trimmed : `${trimmed}.py`
}

/** Reads only .py files from a FileList; everything else is reported as skipped. */
export async function readPyFiles(list: FileList | File[]): Promise<{ files: Array<{ name: string; content: string }>; skipped: string[] }> {
  const files: Array<{ name: string; content: string }> = []
  const skipped: string[] = []
  for (const f of Array.from(list)) {
    if (!f.name.toLowerCase().endsWith('.py')) { skipped.push(f.name); continue }
    files.push({ name: f.name, content: await f.text() })
  }
  return { files, skipped }
}

// ── Minimal ZIP writer (stored, no compression) for "Export all" ──────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(b: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function makeZip(files: Array<{ name: string; content: string }>): Blob {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  const d = new Date()
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()

  for (const f of files) {
    const name = enc.encode(f.name)
    const data = enc.encode(f.content)
    const crc = crc32(data)

    const lh = new Uint8Array(30 + name.length)
    const l = new DataView(lh.buffer)
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true)
    l.setUint16(8, 0, true); l.setUint16(10, dosTime, true); l.setUint16(12, dosDate, true)
    l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true)
    l.setUint16(26, name.length, true); l.setUint16(28, 0, true)
    lh.set(name, 30)

    const ch = new Uint8Array(46 + name.length)
    const c = new DataView(ch.buffer)
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true)
    c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, dosTime, true)
    c.setUint16(14, dosDate, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true)
    c.setUint32(24, data.length, true); c.setUint16(28, name.length, true)
    c.setUint32(42, offset, true)
    ch.set(name, 46)

    parts.push(lh, data)
    central.push(ch)
    offset += lh.length + data.length
  }

  const cdSize = central.reduce((s, b) => s + b.length, 0)
  const end = new Uint8Array(22)
  const e = new DataView(end.buffer)
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true)
  e.setUint32(12, cdSize, true); e.setUint32(16, offset, true)

  return new Blob([...parts, ...central, end] as BlobPart[], { type: 'application/zip' })
}
