import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
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
import type { ContractGenerationModel } from '../contracts';
import {
  CONTRACT_TEMPLATE_FIELD_BINDINGS,
  CONTRACT_TEMPLATE_HEIGHT,
  CONTRACT_TEMPLATE_PAGE_COUNT,
  CONTRACT_TEMPLATE_URL,
  CONTRACT_TEMPLATE_WIDTH,
  CONTRACT_TEMPLATE_YELLOW_RECTS,
  type ContractTemplateFieldKey,
} from '../contractTemplate';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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
      const viewport = page.getViewport({ scale: 1.65 });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      renderTask = page.render({ canvasContext: context, viewport });
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
  model,
  activeField,
}: {
  model: ContractGenerationModel;
  activeField: ContractTemplateFieldKey | null;
}) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(0.92);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    let active = true;
    const loadingTask = getDocument(CONTRACT_TEMPLATE_URL);
    void loadingTask.promise
      .then((loadedDocument) => {
        if (!active) return;
        setDocument(loadedDocument);
        setLoadError('');
      })
      .catch(() => {
        if (active) setLoadError('合同模板加载失败，请刷新页面重试。');
      });
    return () => {
      active = false;
      void loadingTask.destroy();
    };
  }, []);

  const fieldBindings = useMemo(() => (
    CONTRACT_TEMPLATE_FIELD_BINDINGS.reduce<Record<number, typeof CONTRACT_TEMPLATE_FIELD_BINDINGS>>(
      (result, binding) => ({
        ...result,
        [binding.page]: [...(result[binding.page] ?? []), binding],
      }),
      {},
    )
  ), []);
  const yellowRects = useMemo(() => (
    CONTRACT_TEMPLATE_YELLOW_RECTS.reduce<Record<number, typeof CONTRACT_TEMPLATE_YELLOW_RECTS>>(
      (result, rect) => ({
        ...result,
        [rect.page]: [...(result[rect.page] ?? []), rect],
      }),
      {},
    )
  ), []);

  const goToPage = (page: number) => {
    const next = Math.min(CONTRACT_TEMPLATE_PAGE_COUNT, Math.max(1, page));
    setCurrentPage(next);
    pageRefs.current[next - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!activeField) return;
    const page = CONTRACT_TEMPLATE_FIELD_BINDINGS.find((binding) => binding.fieldKey === activeField)?.page;
    if (page) goToPage(page);
  }, [activeField]);

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
    if (nearest.page !== currentPage) setCurrentPage(nearest.page);
  };

  return (
    <aside className="contract-template-preview" aria-label="合同模板实时预览">
      <div className="contract-template-preview-head">
        <div>
          <strong>实时预览</strong>
          <span>A4 · 17 页 · 字段写入位置</span>
        </div>
        <div className="contract-preview-controls">
          <button type="button" title="上一页" aria-label="上一页" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={15} /></button>
          <span>{currentPage} / {CONTRACT_TEMPLATE_PAGE_COUNT}</span>
          <button type="button" title="下一页" aria-label="下一页" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === CONTRACT_TEMPLATE_PAGE_COUNT}><ChevronRight size={15} /></button>
          <i />
          <button type="button" title="缩小" aria-label="缩小合同预览" onClick={() => setZoom((value) => Math.max(0.72, value - 0.1))}><Minus size={14} /></button>
          <button type="button" title="放大" aria-label="放大合同预览" onClick={() => setZoom((value) => Math.min(1.32, value + 0.1))}><Plus size={14} /></button>
        </div>
      </div>
      <div className="contract-template-viewport" ref={viewportRef} onScroll={syncCurrentPage}>
        {loadError ? <div className="contract-template-load-error" role="alert">{loadError}</div> : null}
        {!document && !loadError ? <div className="contract-template-loading">正在加载合同模板…</div> : null}
        {document ? Array.from({ length: CONTRACT_TEMPLATE_PAGE_COUNT }, (_, index) => {
          const pageNumber = index + 1;
          return (
            <article
              className="contract-template-page"
              key={pageNumber}
              ref={(element) => { pageRefs.current[index] = element; }}
              style={{
                width: `${zoom * 100}%`,
                aspectRatio: `${CONTRACT_TEMPLATE_WIDTH} / ${CONTRACT_TEMPLATE_HEIGHT}`,
              }}
              aria-label={`合同模板第 ${pageNumber} 页`}
            >
              <PdfCanvas document={document} pageNumber={pageNumber} />
              <div className="contract-template-overlay" aria-hidden="true">
                {(yellowRects[pageNumber] ?? []).map((rect, rectIndex) => (
                  <span
                    className="contract-template-clear"
                    key={`${pageNumber}-clear-${rectIndex}`}
                    style={{
                      left: `${rect.x / CONTRACT_TEMPLATE_WIDTH * 100}%`,
                      top: `${rect.top / CONTRACT_TEMPLATE_HEIGHT * 100}%`,
                      width: `${rect.width / CONTRACT_TEMPLATE_WIDTH * 100}%`,
                      height: `${rect.height / CONTRACT_TEMPLATE_HEIGHT * 100}%`,
                    }}
                  />
                ))}
                {(fieldBindings[pageNumber] ?? []).map((binding) => (
                  <span
                    className={`contract-template-value ${activeField === binding.fieldKey ? 'contract-template-value-active' : ''}`}
                    key={binding.id}
                    style={{
                      left: `${binding.x / CONTRACT_TEMPLATE_WIDTH * 100}%`,
                      top: `${binding.top / CONTRACT_TEMPLATE_HEIGHT * 100}%`,
                      width: `${binding.width / CONTRACT_TEMPLATE_WIDTH * 100}%`,
                      height: `${binding.height / CONTRACT_TEMPLATE_HEIGHT * 100}%`,
                      fontSize: `${binding.fontSize / CONTRACT_TEMPLATE_WIDTH * 100}cqw`,
                    }}
                  >
                    {binding.value(model)}
                  </span>
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
