import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'

type Layer = {
  id: string
  name: string
  color: string
  pages: number[]
  objects: number
  size: string
  description: string
  visible: boolean
}

const layerColors = ['#ffb454', '#f57967', '#b78cff', '#58c7b0', '#75a9ff', '#aeb7c8', '#657186']

function Icon({ children }: { children: string }) {
  return <span className="icon" aria-hidden="true">{children}</span>
}

function RenderedPage({ file, page, visibleLayers, apiUrl }: { file: File | null; page: number; visibleLayers: string[]; apiUrl: string | undefined }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!file || !apiUrl) return
    let cancelled = false
    setError(null)
    const body = new FormData()
    body.append('file', file)
    body.append('page', String(page))
    body.append('visible_layers', JSON.stringify(visibleLayers))
    fetch(`${apiUrl}/render`, { method: 'POST', body }).then(async (response) => {
      if (!response.ok) throw new Error(await response.text())
      return response.blob()
    }).then((blob) => {
      if (cancelled) return
      setImageUrl(URL.createObjectURL(blob))
    }).catch((reason: unknown) => {
      if (!cancelled) {
        const detail = reason instanceof Error ? reason.message : 'Unknown PDF.js error'
        setError(`PyMuPDF could not render this page: ${detail}`)
      }
    })
    return () => {
      cancelled = true
      setImageUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return null
      })
    }
  }, [apiUrl, file, page, visibleLayers])

  if (!file) return null
  return error
    ? <div className="render-error" role="alert">{error}</div>
    : imageUrl ? <img src={imageUrl} className="pdf-canvas" alt={`Rendered PDF page ${page}`} /> : <div className="render-loading">Rendering page with PyMuPDF…</div>
}

function App() {
  const [layers, setLayers] = useState<Layer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'json'>('overview')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [contentObjects, setContentObjects] = useState(0)
  const [pagesWithContent, setPagesWithContent] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

  const filteredLayers = useMemo(() => layers.filter((layer) => layer.name.toLowerCase().includes(search.toLowerCase())), [layers, search])
  const selected = layers.find((layer) => layer.id === selectedId) ?? null
  const visibleCount = layers.filter((layer) => layer.visible).length
  const layerJson = layers.map(({ visible: _visible, ...layer }) => layer)

  useEffect(() => {
    function clearSelection(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', clearSelection)
    return () => window.removeEventListener('keydown', clearSelection)
  }, [])

  function toggleLayer(id: string) {
    setLayers((current) => current.map((layer) => layer.id === id ? { ...layer, visible: !layer.visible } : layer))
  }

  function selectLayer(id: string) {
    setSelectedId((current) => current === id ? null : id)
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      setFileName(file.name)
      setUploadedFile(file)
      setLayers([])
      setSelectedId(null)
      setAnalysisError(null)
      if (!apiUrl) return

      const body = new FormData()
      body.append('file', file)
      try {
        const response = await fetch(`${apiUrl}/analyze`, { method: 'POST', body })
        const result: { detail?: string; layers?: Omit<Layer, 'color'>[]; page_count?: number; content_objects?: number; pages_with_content?: number } = await response.json()
        if (!response.ok) throw new Error(result.detail || 'The API could not analyze this PDF.')
        if (result.layers?.length) {
          const analyzedLayers = result.layers.map((layer, index) => ({ ...layer, color: layerColors[index % layerColors.length] }))
          setLayers(analyzedLayers)
          setSelectedId(analyzedLayers[0].id)
        }
        setPageCount(result.page_count || 0)
        setContentObjects(result.content_objects || 0)
        setPagesWithContent(result.pages_with_content || 0)
      } catch (reason: unknown) {
        setAnalysisError(reason instanceof Error ? reason.message : 'The API could not analyze this PDF.')
      }
    }
  }

  const visibleLayers = useMemo(() => layers.filter((layer) => layer.visible).map((layer) => layer.name), [layers])

  async function toggleFullscreen() {
    if (!viewerRef.current) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await viewerRef.current.requestFullscreen()
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">◈</div><span>Layer<span className="brand-accent">Scope</span></span><span className="beta">BETA</span></div>
        <div className="topbar-actions"><span className="local-pill"><span className="status-dot" /> Local processing</span><button className="icon-button" aria-label="Help">?</button><div className="avatar">JD</div></div>
      </header>
      <main className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading"><span>DOCUMENT</span><button className="more-button">•••</button></div>
          {fileName ? <div className="document-card"><div className="pdf-badge">PDF</div><div className="document-copy"><strong>{fileName}</strong><span>Analyzing locally…</span></div><Icon>⋮</Icon></div> : <div className="empty-document">Upload a PDF drawing to begin.</div>}
          <div className="upload-row"><input ref={fileInput} type="file" accept=".pdf" onChange={handleFile} hidden /><button className="upload-button" onClick={() => fileInput.current?.click()}><Icon>↑</Icon> Upload drawing</button>{analysisError && <p className="analysis-error" role="alert">{analysisError}</p>}</div>
          <div className="sidebar-heading layers-heading"><span>LAYERS <em>{layers.length}</em></span><button className="filter-button"><Icon>≡</Icon></button></div>
          <label className="search-box"><Icon>⌕</Icon><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter layers..." /><kbd>/</kbd></label>
          <div className="layer-list">{filteredLayers.length ? filteredLayers.map((layer) => <button key={layer.id} className={`layer-row ${selectedId === layer.id ? 'selected' : ''}`} onClick={() => selectLayer(layer.id)}><span className="layer-swatch" style={{ backgroundColor: layer.color }} /><span className="layer-name">{layer.name}<small>{layer.objects.toLocaleString()} objects</small></span><span className={`eye ${layer.visible ? 'visible' : 'hidden'}`} title={layer.visible ? 'Hide layer' : 'Show layer'} aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`} onClick={(event) => { event.stopPropagation(); toggleLayer(layer.id) }} /></button>) : <div className="empty-layers">No layers to show yet.</div>}</div>
          <div className="sidebar-footer"><div><span className="status-dot green" /> <strong>{visibleCount}</strong> of {layers.length} layers visible</div><span>v1.0.0</span></div>
        </aside>
        <section className="content">
          <div className="page-header"><div><div className="eyebrow">DRAWING INSPECTOR {fileName && <><span className="divider">/</span> {fileName.toUpperCase()}</>}</div><h1>CAD Layer Explorer</h1><p>Inspect, isolate, and understand every layer in your drawing.</p></div><button className="export-button" disabled={!fileName}><Icon>⇩</Icon> Export report</button></div>
          <div className="stats-grid"><div className="stat-card"><span className="stat-label">LAYERS DETECTED</span><strong>{layers.length}</strong><span className="stat-meta success">{fileName ? '● Analysis complete' : 'Waiting for drawing'}</span></div><div className="stat-card"><span className="stat-label">DRAWING PAGES</span><strong>{pageCount || '—'}</strong><span className="stat-meta">{pagesWithContent ? `${pagesWithContent} pages with content` : 'No document loaded'}</span></div><div className="stat-card"><span className="stat-label">CONTENT OBJECTS</span><strong>{contentObjects ? contentObjects.toLocaleString() : '—'}</strong><span className="stat-meta">{contentObjects ? 'Across all pages' : 'No document loaded'}</span></div><div className="stat-card"><span className="stat-label">EMPTY LAYERS</span><strong className="amber">{layers.length ? layers.filter((layer) => layer.objects === 0).length : '—'}</strong><span className="stat-meta">Available after analysis</span></div></div>
          <div className="viewer-card" ref={viewerRef}>
            <div className="viewer-toolbar"><div className="toolbar-group"><button className="tool-button active"><Icon>⌖</Icon> Select</button><button className="tool-button"><Icon>⌁</Icon> Measure</button><button className="tool-button"><Icon>⊞</Icon> Pan</button></div><div className="toolbar-group right"><button className="tool-button">−</button><span>100%</span><button className="tool-button">＋</button><span className="toolbar-divider" /><button className="tool-button fullscreen-button" aria-label="Toggle full screen" title="Toggle full screen" onClick={toggleFullscreen}>⛶</button></div></div>
              <div className="viewer-stage"><RenderedPage file={uploadedFile} page={page} visibleLayers={visibleLayers} apiUrl={apiUrl} />{!uploadedFile && <div className="empty-viewer"><span className="empty-viewer-icon">＋</span><strong>Your drawing will appear here</strong><span>Upload a PDF to inspect its pages and layers.</span><button className="upload-button" onClick={() => fileInput.current?.click()}>Choose PDF drawing</button></div>}<div className="viewer-label"><span className="status-dot green" /> {uploadedFile ? `PyMuPDF render · ${visibleCount} layers visible` : 'No drawing loaded'}</div></div>
              <div className="viewer-footer"><button className="page-arrow" disabled={!uploadedFile} onClick={() => setPage(Math.max(1, page - 1))}>‹</button><span>Page <strong>{uploadedFile ? page : '—'}</strong> {uploadedFile && `of ${pageCount}`}</span><button className="page-arrow" disabled={!uploadedFile} onClick={() => setPage(Math.min(pageCount || 1, page + 1))}>›</button><span className="footer-spacer" /><span className="snap-pill">⌁ Vector geometry ready</span><span className="pdfjs-mark">Powered by <strong>PyMuPDF</strong></span></div>
          </div>
          <div className="details-header"><div><h2>Layer details</h2><p>Structured data extracted from the PDF's optional content groups.</p></div><div className="tabs"><button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Overview</button><button className={activeTab === 'json' ? 'active' : ''} onClick={() => setActiveTab('json')}>JSON <span>↗</span></button></div></div>
          {activeTab === 'overview' ? <div className="details-grid"><div className="table-card">{layers.length ? <table><thead><tr><th>Layer name</th><th>Pages</th><th>Objects</th><th>Size</th><th>Status</th></tr></thead><tbody>{filteredLayers.map((layer) => <tr key={layer.id} className={selectedId === layer.id ? 'row-selected' : ''} onClick={() => selectLayer(layer.id)}><td><span className="layer-swatch" style={{ backgroundColor: layer.color }} />{layer.name}</td><td>{layer.pages.length ? layer.pages.slice(0, 3).join(', ') + (layer.pages.length > 3 ? ` +${layer.pages.length - 3}` : '') : '—'}</td><td>{layer.objects.toLocaleString()}</td><td>{layer.size}</td><td><span className={`status-tag ${layer.objects ? 'content' : 'empty'}`}>{layer.objects ? 'Has content' : 'Empty'}</span></td></tr>)}</tbody></table> : <div className="empty-table">Layer analysis will appear here after you upload a PDF.</div>}</div>{selected ? <div className="inspector-card"><div className="inspector-title"><span className="layer-swatch large" style={{ backgroundColor: selected.color }} /><div><span>SELECTED LAYER</span><h3>{selected.name}</h3></div><button className="eye-large" onClick={() => toggleLayer(selected.id)}>{selected.visible ? '◉' : '○'}</button></div><p>{selected.description}</p><div className="inspector-metrics"><div><span>Pages</span><strong>{selected.pages.length || '—'}</strong></div><div><span>Objects</span><strong>{selected.objects.toLocaleString()}</strong></div><div><span>Footprint</span><strong>{selected.size}</strong></div></div><button className="isolate-button" onClick={() => setLayers((current) => current.map((layer) => ({ ...layer, visible: layer.id === selected.id })))}><Icon>◉</Icon> Isolate layer</button></div> : <div className="inspector-card empty-inspector"><strong>Select a layer</strong><span>Layer details will appear after analysis.</span></div>}</div> : <pre className="json-panel">{JSON.stringify(layerJson, null, 2)}</pre>}
        </section>
      </main>
    </div>
  )
}

export default App
