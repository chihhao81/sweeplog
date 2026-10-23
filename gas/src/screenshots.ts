import { deleteRows, readRows, upsertRows, type Row } from './sheets'

// Root Drive folder for screenshots; files go into YYYY/MM subfolders.
// Drive safety: this module is the only Drive code. It only opens this folder,
// creates subfolders and files inside it, and shares the files it just created.
// It never edits, moves, trashes or deletes any existing Drive item.
const ROOT_FOLDER_ID = '1uovN7NmXDveaBltnbe11RGl5aG_-7g-_'

export interface UploadInput {
  date: string // trade day, YYYY-MM-DD
  fileName: string
  mimeType: string
  base64: string
  takenAt?: string
  caption?: string
  positionIds?: string[]
}

export function uploadScreenshot(input: UploadInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('截圖缺少日期')
  const [yyyy, mm] = input.date.split('-')
  const folder = childFolder(childFolder(DriveApp.getFolderById(ROOT_FOLDER_ID), yyyy), mm)

  const id = Utilities.getUuid()
  const blob = Utilities.newBlob(Utilities.base64Decode(input.base64), input.mimeType, `${input.date}_${input.fileName}`)
  const file = folder.createFile(blob)
  // The web app loads images straight from Drive, so files are viewable by link.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)

  const row: Row = {
    id,
    date: input.date,
    driveFileId: file.getId(),
    fileName: input.fileName,
    caption: input.caption ?? null,
    takenAt: input.takenAt ?? null,
    createdAt: new Date().toISOString(),
  }
  upsertRows('Screenshots', [row])
  setLinks(id, input.positionIds ?? [])
  return { ...row, positionIds: input.positionIds ?? [] }
}

/** Screenshots of one trade day (or all when no date), each with its linked positions. */
export function listScreenshots(date?: string) {
  const shots = readRows('Screenshots').filter((r) => !date || r.date === date)
  const ids = new Set(shots.map((s) => String(s.id)))
  const links = readRows('PositionScreenshots').filter((l) => ids.has(String(l.screenshotId)))
  return shots.map((s) => ({
    ...s,
    positionIds: links.filter((l) => l.screenshotId === s.id).map((l) => String(l.positionId)),
  }))
}

export function updateScreenshot(p: { id: string; caption?: string | null; positionIds?: string[] }) {
  if (p.caption !== undefined) upsertRows('Screenshots', [{ id: p.id, caption: p.caption }], { insert: false })
  if (p.positionIds) setLinks(p.id, p.positionIds)
  return { id: p.id }
}

/**
 * Removes the screenshot from the journal (its sheet row and links) only.
 * The Drive file is never touched: this script does not delete or trash files.
 */
export function deleteScreenshot(id: string) {
  const row = readRows('Screenshots').find((r) => r.id === id)
  if (!row) throw new Error('找不到截圖')
  deleteRows('PositionScreenshots', (l) => l.screenshotId === id)
  deleteRows('Screenshots', (r) => r.id === id)
  return { id }
}

function setLinks(screenshotId: string, positionIds: string[]) {
  deleteRows('PositionScreenshots', (l) => l.screenshotId === screenshotId)
  upsertRows(
    'PositionScreenshots',
    [...new Set(positionIds)].map((positionId) => ({ id: `${positionId}|${screenshotId}`, positionId, screenshotId })),
  )
}

function childFolder(parent: GoogleAppsScript.Drive.Folder, name: string) {
  const it = parent.getFoldersByName(name)
  return it.hasNext() ? it.next() : parent.createFolder(name)
}

/**
 * Run from the editor. Re-prompts for any scope the user left unchecked on the
 * consent screen, then proves write access by ensuring this year's folder exists
 * (the same folder uploads use, so nothing extra is left behind).
 */
export function checkDriveAccess(): string {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL)
  const root = DriveApp.getFolderById(ROOT_FOLDER_ID)
  childFolder(root, String(new Date().getFullYear()))
  return root.getName()
}
