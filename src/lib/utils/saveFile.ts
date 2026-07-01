import { downloadDataUrl } from '@/lib/utils/image'

let sessionDirHandle: FileSystemDirectoryHandle | null = null

export function getSessionSaveDirectory(): FileSystemDirectoryHandle | null {
  return sessionDirHandle
}

export function setSessionSaveDirectory(handle: FileSystemDirectoryHandle | null) {
  sessionDirHandle = handle
}

export function isDirectorySaveSupported(): boolean {
  return typeof window.showDirectoryPicker === 'function'
}

export function isSaveFilePickerSupported(): boolean {
  return typeof window.showSaveFilePicker === 'function'
}

export async function pickSaveDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!isDirectorySaveSupported()) return null
  try {
    return await window.showDirectoryPicker!({ mode: 'readwrite' })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null
    throw err
  }
}

async function ensureDirPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const query = await handle.queryPermission?.({ mode: 'readwrite' })
  if (query === 'granted') return true
  const req = await handle.requestPermission?.({ mode: 'readwrite' })
  return req === 'granted'
}

export async function saveBlobToDirectory(
  dirHandle: FileSystemDirectoryHandle,
  blob: Blob,
  filename: string,
): Promise<void> {
  const ok = await ensureDirPermission(dirHandle)
  if (!ok) throw new Error('没有文件夹写入权限')

  const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()
}

async function saveWithFilePicker(blob: Blob, filename: string): Promise<boolean> {
  if (!isSaveFilePickerSupported()) return false

  const ext = filename.split('.').pop()?.toLowerCase() ?? 'png'
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'

  try {
    const handle = await window.showSaveFilePicker!({
      suggestedName: filename,
      types: [{ description: ext.toUpperCase(), accept: { [mime]: [`.${ext}`] } }],
    })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return true
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return false
    throw err
  }
}

export type SaveResult =
  | { method: 'folder'; folderName: string; cancelled?: false }
  | { method: 'picker'; cancelled?: false }
  | { method: 'browser'; cancelled?: false }
  | { method: 'cancelled'; cancelled: true }

/** 下载时选择文件夹并保存；不支持时降级为另存为/浏览器下载 */
export async function saveBlobOnDownload(blob: Blob, filename: string): Promise<SaveResult> {
  if (isDirectorySaveSupported()) {
    const dir = await pickSaveDirectory()
    if (!dir) return { method: 'cancelled', cancelled: true }
    sessionDirHandle = dir
    await saveBlobToDirectory(dir, blob, filename)
    return { method: 'folder', folderName: dir.name }
  }

  if (await saveWithFilePicker(blob, filename)) {
    return { method: 'picker' }
  }

  const url = URL.createObjectURL(blob)
  try {
    downloadDataUrl(url, filename)
  } finally {
    URL.revokeObjectURL(url)
  }
  return { method: 'browser' }
}

export async function saveDataUrlOnDownload(
  dataUrl: string,
  filename: string,
): Promise<SaveResult> {
  const blob = await fetch(dataUrl).then((r) => r.blob())
  return saveBlobOnDownload(blob, filename)
}
