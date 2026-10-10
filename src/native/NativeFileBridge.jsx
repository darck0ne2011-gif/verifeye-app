import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isNative, takePendingNativeFile, watchPendingNativeFile } from './verifeye'
import { storePendingFile } from './pendingFileStore'

/**
 * Mounted on every signed-in route. Whenever another app shares a file or the
 * bubble captures the screen, the file is parked and the home page is opened
 * on it, whatever screen the app was showing.
 */
export default function NativeFileBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isNative) return undefined
    const deliver = (pending) => {
      if (!pending?.file) return
      storePendingFile(pending)
      navigate('/', { state: { nativeFile: Date.now() } })
    }
    takePendingNativeFile()
      .then(deliver)
      .catch(() => {})
    return watchPendingNativeFile(deliver)
  }, [navigate])

  return null
}
