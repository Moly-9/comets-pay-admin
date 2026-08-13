import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ContractFieldAnchor,
  ContractQualityIssue,
  ContractQualityReport,
  ContractTemplateFieldKey,
} from '../contracts';
import {
  CONTRACT_TEMPLATE_HEIGHT,
  CONTRACT_TEMPLATE_WIDTH,
} from '../contractTemplate';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PreviewMode = 'fit-page' | 'fit-width' | 'custom';

type HighlightRequest = {
  fieldKey: ContractTemplateFieldKey;
  nonce: number;
} | null;

type Props = {
  pdfUrl: string | null;
  pageCount: number;
  anchors: ContractFieldAnchor[];
  qualityReport: ContractQualityReport;
  highlightRequest: HighlightRequest;
  loading: boolean;
  canDownloadPdf: boolean;
  canDownloadDocx: boolean;
  onDownloadPdf: () => void;
  onDownloadDocx: () => void;
  onIssueSelect: (issue: ContractQualityIssue) => void;
};

function PdfCanvas({
  document,
  pageNumber,
}: {
  document: PDFDocumentProxy;
  pageNumber: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let disposed = false;
    let renderTask: RenderTask | null = null;
    void document.getPage(pageNumber).then((page) => {
      if (disposed || !canvasRef.current) return;
      const viewport = page.getViewport({ scale: 1.8 });
      const context = canvasRef.current.getContext('2d');
      if (!context) return;
      canvasRef.current.width = Math.floor(viewport.width);
      canvasRef.current.height = Math.floor(viewport.height);
      renderTask = page.render({
        canvasContext: context,
        viewport,
      });
      return renderTask.promise;
    }).catch(() => undefined);

    return () => {
      disposed = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber]);

  return <canvas ref={canvasRef} aria-hidden="true" />;
}

export function ContractTemplatePreview({
  pdfUrl,
  pageCount,
  anchors,
  qualityReport,
  highlightRequest,
  loading,
  canDownloadPdf,
  canDownloadDocx,
  onDownloadPdf,
  onDownloadDocx,
  onIssueSelect,
}: Props) {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [mode, setMode] = useState<PreviewMode>('fit-page');
  const [zoom, setZoom] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [highlightedAnchorId, setHighlightedAnchorId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Array<HTMLElement | null>>([]);

  const resolvedPageCount = pdfDocument?.numPages ?? pageCount;

  useEffect(() => {
    if (!pdfUrl) {
      setPdfDocument(null);
      setLoadError('');
      return undefined;
    }
    let active = true;
    const loadingTask = getDocument(pdfUrl);
    void loadingTask.promise
      .then((loadedDocument) => {
        if (!active) return;
        setPdfDocument(loadedDocument);
        setLoadError('');
        setCurrentPage((page) => Math.min(page, loadedDocument.numPages));
      })
      .catch(() => {
        if (active) setLoadError('合同预览加载失败，请重新生成预览。');
      });
    return () => {
      active = false;
      void loadingTask.destroy();
    };
  }, [pdfUrl]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const updateSize = () => setViewportSize({
      width: viewport.clientWidth,
      height: viewport.clientHeight,
    });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!fullscreen) return undefined;
    const exitOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', exitOnEscape);
    return () => window.removeEventListener('keydown', exitOnEscape);
  }, [fullscreen]);

  const pageWidth = useMemo(() => {
    const availableWidth = Math.max(240, viewportSize.width - 34);
    const availableHeight = Math.max(320, viewportSize.height - 34);
    if (mode === 'fit-width') return availableWidth;
    if (mode === 'fit-page') {
      return Math.min(availableWidth, availableHeight * CONTRACT_TEMPLATE_WIDTH / CONTRACT_TEMPLATE_HEIGHT);
    }
    return CONTRACT_TEMPLATE_WIDTH * zoom;
  }, [mode, viewportSize, zoom]);

  const goToPage = (page: number, behavior: ScrollBehavior = 'auto') => {
    const next = Math.min(Math.max(1, resolvedPageCount || 1), Math.max(1, page));
    setCurrentPage(next);
    setPageInput(String(next));
    const viewport = viewportRef.current;
    const target = pageRefs.current[next - 1];
    if (viewport && target) {
      const top = viewport.scrollTop
        + target.getBoundingClientRect().top
        - viewport.getBoundingClientRect().top;
      viewport.scrollTo({ top, behavior });
    }
  };

  useEffect(() => {
    if (!highlightRequest) return undefined;
    const anchor = anchors.find((item) => item.fieldKey === highlightRequest.fieldKey);
    if (!anchor) return undefined;
    goToPage(anchor.pageNumber);
    setHighlightedAnchorId(anchor.id);
    const timer = window.setTimeout(() => setHighlightedAnchorId(null), 2_000);
    return () => window.clearTimeout(timer);
  }, [anchors, highlightRequest]);

  const syncCurrentPage = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const viewportTop = viewport.getBoundingClientRect().top;
    const nearest = pageRefs.current.reduce(
      (result, page, index) => {
        if (!page) return result;
        const distance = Math.abs(page.getBoundingClientRect().top - viewportTop - 8);
        return distance < result.distance ? { page: index + 1, distance } : result;
      },
      { page: currentPage, distance: Number.POSITIVE_INFINITY },
    );
    if (nearest.page !== currentPage) {
      setCurrentPage(nearest.page);
      setPageInput(String(nearest.page));
    }
  };

  const submitPage = () => {
    const page = Number(pageInput);
    if (Number.isFinite(page)) goToPage(page);
    else setPageInput(String(currentPage));
  };

  const changeZoom = (next: number) => {
    setMode('custom');
    setZoom(Math.min(1.8, Math.max(0.5, next)));
  };

  const visibleIssues = qualityReport.issues.slice(0, 3);

  return (
    <aside className={`contract-template-preview ${fullscreen ? 'is-fullscreen' : ''}`} aria-label="合同结构化实时预览" ref={rootRef}>
      <div className="contract-preview-quality">
        <div>
          <strong>合同完成情况</strong>
          <span>
            已完成 {qualityReport.completedFields}/{qualityReport.totalFields} 个字段，
            {qualityReport.missingRequired} 个必填字段缺失，
            {qualityReport.overflowRisks} 个字段可能溢出
          </span>
        </div>
        {visibleIssues.length ? (
          <div className="contract-quality-issues" aria-label="合同质量问题">
            {visibleIssues.map((issue) => (
              <button
                type="button"
                className={issue.severity === 'BLOCKER' ? 'is-blocker' : 'is-warning'}
                key={issue.id}
                onClick={() => onIssueSelect(issue)}
              >
                <span>{issue.message}</span>
                <small>第 {issue.pageNumber} 页</small>
              </button>
            ))}
            {qualityReport.issues.length > visibleIssues.length ? (
              <span className="contract-quality-more">
                另有 {qualityReport.issues.length - visibleIssues.length} 项
              </span>
            ) : null}
          </div>
        ) : (
          <span className="contract-quality-pass">未发现阻断项，仍需人工复核合同正文。</span>
        )}
      </div>

      <div className="contract-template-preview-head">
        <div>
          <strong>实时预览</strong>
          <span>A4 · {resolvedPageCount || pageCount || 17} 页 · 本地草稿</span>
        </div>
        <div className="contract-preview-controls">
          <button type="button" title="上一页" aria-label="上一页" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}><ChevronLeft size={15} /></button>
          <label className="contract-page-input">
            <input
              aria-label="当前合同页码"
              inputMode="numeric"
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              onBlur={submitPage}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitPage();
              }}
            />
            <span className="contract-page-separator" aria-hidden="true">/</span>
            <span className="contract-page-total">{resolvedPageCount || pageCount || 17}</span>
          </label>
          <button type="button" title="下一页" aria-label="下一页" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= resolvedPageCount}><ChevronRight size={15} /></button>
          <i />
          <button type="button" className={mode === 'fit-page' ? 'is-active' : ''} onClick={() => setMode('fit-page')}>适合页面</button>
          <button type="button" className={mode === 'fit-width' ? 'is-active' : ''} onClick={() => setMode('fit-width')}>适合宽度</button>
          <button type="button" title="缩小" aria-label="缩小合同预览" onClick={() => changeZoom(mode === 'custom' ? zoom - 0.1 : 0.9)}><Minus size={14} /></button>
          <button type="button" title="放大" aria-label="放大合同预览" onClick={() => changeZoom(mode === 'custom' ? zoom + 0.1 : 1.1)}><Plus size={14} /></button>
          <button type="button" title="恢复 100%" aria-label="恢复合同预览至 100%" onClick={() => changeZoom(1)}><RotateCcw size={14} /></button>
          <span className="contract-zoom-value">{mode === 'custom' ? `${Math.round(zoom * 100)}%` : mode === 'fit-page' ? '整页' : '宽度'}</span>
          <button
            type="button"
            title={fullscreen ? '退出全屏' : '全屏预览'}
            aria-label={fullscreen ? '退出全屏' : '全屏预览'}
            onClick={() => setFullscreen((value) => !value)}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <i />
          <button type="button" title="下载 PDF" aria-label="下载 PDF" disabled={!canDownloadPdf} onClick={onDownloadPdf}><Download size={14} /><span>PDF</span></button>
          <button type="button" title="下载 DOCX" aria-label="下载 DOCX" disabled={!canDownloadDocx} onClick={onDownloadDocx}><Download size={14} /><span>DOCX</span></button>
        </div>
      </div>

      <div className="contract-template-viewport" ref={viewportRef} onScroll={syncCurrentPage}>
        {loadError ? <div className="contract-template-load-error" role="alert">{loadError}</div> : null}
        {(loading || (!pdfDocument && !loadError)) ? <div className="contract-template-loading">正在生成结构化合同预览…</div> : null}
        {pdfDocument ? Array.from({ length: resolvedPageCount }, (_, index) => {
          const pageNumber = index + 1;
          const pageAnchors = anchors.filter((anchor) => anchor.pageNumber === pageNumber);
          return (
            <article
              className="contract-template-page"
              key={pageNumber}
              ref={(element) => { pageRefs.current[index] = element; }}
              style={{
                width: `${pageWidth}px`,
                aspectRatio: `${CONTRACT_TEMPLATE_WIDTH} / ${CONTRACT_TEMPLATE_HEIGHT}`,
              }}
              aria-label={`合同第 ${pageNumber} 页`}
            >
              <PdfCanvas document={pdfDocument} pageNumber={pageNumber} />
              <div className="contract-template-overlay" aria-hidden="true">
                {pageAnchors.map((anchor) => (
                  <span
                    className={highlightedAnchorId === anchor.id ? 'contract-template-anchor is-highlighted' : 'contract-template-anchor'}
                    key={anchor.id}
                    style={{
                      left: `${anchor.x / CONTRACT_TEMPLATE_WIDTH * 100}%`,
                      top: `${anchor.top / CONTRACT_TEMPLATE_HEIGHT * 100}%`,
                      width: `${anchor.width / CONTRACT_TEMPLATE_WIDTH * 100}%`,
                      height: `${anchor.height / CONTRACT_TEMPLATE_HEIGHT * 100}%`,
                    }}
                  />
                ))}
              </div>
              <small className="contract-template-page-number">第 {pageNumber} 页</small>
            </article>
          );
        }) : null}
      </div>
    </aside>
  );
}
