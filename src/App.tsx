import { useEffect, useState } from 'react'
import { useEditor } from './store/editor'
import { VideoUploader } from './components/VideoUploader'
import { PreviewCanvas } from './components/PreviewCanvas'
import { SubtitleStylePanel } from './components/SubtitleStylePanel'
import { SubtitleImporter } from './components/SubtitleImporter'
import { WatermarkPanel } from './components/WatermarkPanel'
import { Timeline } from './components/Timeline/Timeline'
import { ExportButton } from './components/ExportButton'
import { LyricsAligner } from './components/LyricsAligner'
import { DEMO_WATERMARK_DATA_URL, makeDemoSubtitles } from './lib/demo'
import { clearSnapshot, loadSnapshot, onSaveStatus, startAutosave } from './store/persistence'
import { injectBundledFonts, injectGoogleFonts } from './lib/fonts'

injectBundledFonts()
injectGoogleFonts()

export function App() {
  const hasUnsupportedBrowser = useEditor((s) => s.hasUnsupportedBrowser)
  const videoUrl = useEditor((s) => s.videoUrl)
  const meta = useEditor((s) => s.videoMeta)
  const clearVideo = useEditor((s) => s.clearVideo)
  const setSubtitles = useEditor((s) => s.setSubtitles)
  const setWatermark = useEditor((s) => s.setWatermark)
  const hydrate = useEditor((s) => s.hydrate)
  const [hydrated, setHydrated] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle')

  useEffect(() => {
    let cancelled = false
    void loadSnapshot().then((snap) => {
      if (cancelled) return
      if (snap) hydrate(snap)
      setHydrated(true)
    })
    onSaveStatus((s) => setSaveStatus(s))
    const unsub = startAutosave()
    return () => {
      cancelled = true
      unsub()
    }
  }, [hydrate])

  if (hasUnsupportedBrowser) {
    return (
      <div className="flex h-screen items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="mb-4 text-2xl font-semibold">瀏覽器不支援</h1>
          <p className="text-zinc-400">
            這個工具需要 WebCodecs API（VideoEncoder），請使用 Chrome 或 Edge 開啟。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-zinc-900 px-6 py-3">
        <h1 className="text-lg font-semibold">Subtitler</h1>
        {videoUrl && (
          <div className="flex items-center gap-2">
            <span className="mr-2 text-[10px] text-zinc-500">
              {saveStatus === 'saving' && '儲存中…'}
              {saveStatus === 'error' && '儲存失敗'}
            </span>
            <button
              className="rounded-md border border-border px-3 py-1 text-xs hover:bg-zinc-800"
              onClick={() => {
                if (!meta) return
                setSubtitles(makeDemoSubtitles(meta.duration))
                setWatermark({ imageDataUrl: DEMO_WATERMARK_DATA_URL })
              }}
            >
              載入測試資料
            </button>
            <button
              className="rounded-md border border-border px-3 py-1 text-xs hover:bg-zinc-800"
              onClick={async () => {
                await clearSnapshot()
                clearVideo()
              }}
            >
              清除專案
            </button>
          </div>
        )}
      </header>
      <main className="flex-1 overflow-hidden">
        {!hydrated ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            載入專案…
          </div>
        ) : videoUrl ? (
          <div className="flex h-full">
            <aside className="w-72 shrink-0 overflow-y-auto border-r border-border bg-zinc-900/30">
              <div className="border-b border-border p-4">
                <ExportButton />
              </div>
              <SubtitleImporter />
              <LyricsAligner />
              <SubtitleStylePanel />
              <WatermarkPanel />
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-hidden">
                <PreviewCanvas />
              </div>
              <div className="h-56 shrink-0">
                <Timeline />
              </div>
            </div>
          </div>
        ) : (
          <VideoUploader />
        )}
      </main>
      {saveStatus === 'error' && (
        <div className="border-t border-red-900 bg-red-950/40 px-4 py-2 text-xs text-red-300">
          自動儲存失敗（IndexedDB 配額？） 點「清除專案」釋放空間
        </div>
      )}
    </div>
  )
}
