/**
 * Hands a file from the native bridge to the home page across a navigation.
 * Router state cannot carry a File reliably, so the file waits here and the
 * navigation only carries a ticket.
 */
let pending = null

export function storePendingFile(entry) {
  pending = entry
}

export function takeStoredPendingFile() {
  const p = pending
  pending = null
  return p
}
