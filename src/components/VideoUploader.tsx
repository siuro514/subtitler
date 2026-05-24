import { useCallback, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useEditor } from '@/store/editor'
import type { VideoMeta } from '@/types'
import { cn } from '@/lib/utils'

const ACCEPTED = ['video/mp4', 'video/quicktime']
const ACCEPT_EXT = '.mp4,.mov,.m4v'

async function readVideoMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.muted = true
    v.playsInline = true
    v.src = url

    let done = false
    const finish = () => {
      if (done) return
      if (
        v.videoWidth > 0 &&
        v.videoHeight > 0 &&
        isFinite(v.duration) &&
        v.duration > 0
      ) {
        done = true
        const meta: VideoMeta = {
          name: file.name,
          type: file.type,
          size: file.size,
          duration: v.duration,
          width: v.videoWidth,
          height: v.videoHeight,
        }
        URL.revokeObjectURL(url)
        resolve(meta)
      }
    }
    v.onloadedmetadata = finish
    v.onloadeddata = finish
    v.ondurationchange = finish
    v.onerror = () => {
      if (done) return
      done = true
      URL.revokeObjectURL(url)
      reject(new Error('無法讀取影片 metadata'))
    }
    setTimeout(() => {
      if (done) return
      done = true
      URL.revokeObjectURL(url)
      reject(new Error('讀取影片 metadata 超時'))
    }, 15000)
  })
}

export function VideoUploader() {
  const setVideo = useEditor((s) => s.setVideo)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)
      const ext = file.name.toLowerCase().split('.').pop() ?? ''
      const accepted =
        ACCEPTED.includes(file.type) || ['mp4', 'mov', 'm4v'].includes(ext)
      if (!accepted) {
        setError('只支援 MP4 / MOV 格式')
        return
      }
      if (file.size > 1024 * 1024 * 1024) {
        setError('檔案超過 1GB，瀏覽器可能跑不動')
        return
      }
      setBusy(true)
      try {
        const meta = await readVideoMeta(file)
        setVideo(file, meta)
      } catch (e) {
        setError(e instanceof Error ? e.message : '讀取失敗')
      } finally {
        setBusy(false)
      }
    },
    [setVideo],
  )

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div
        className={cn(
          'flex w-full max-w-xl flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors',
          dragging ? 'border-primary bg-zinc-900' : 'border-border bg-zinc-900/50',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const f = e.dataTransfer.files?.[0]
          if (f) void handleFile(f)
        }}
      >
        <Upload className="mb-4 h-12 w-12 text-zinc-500" />
        <p className="mb-2 text-lg font-medium">上傳影片</p>
        <p className="mb-6 text-sm text-zinc-500">拖放檔案到這裡，或點按鈕選擇</p>
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? '讀取中…' : '選擇檔案'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_EXT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
            e.target.value = ''
          }}
        />
        <p className="mt-4 text-xs text-zinc-600">支援 MP4 / MOV</p>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  )
}
