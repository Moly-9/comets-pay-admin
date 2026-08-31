import {
  CheckCircle2,
  Circle,
  ClipboardPaste,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Search,
  UploadCloud,
  Users,
} from 'lucide-react';
import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import type { CreatorId, ProjectId } from '../businessWorkflow';
import {
  exportInvoiceBatchCreatorTemplate,
  importInvoiceBatchCreatorTemplate,
  INVOICE_BATCH_CREATOR_IMPORT_MAX_FILE_SIZE,
  matchInvoiceBatchCreatorRows,
  type InvoiceBatchProjectCreatorReference,
} from '../invoice/invoiceBatchCreatorImport';
import { downloadBlob } from '../invoice/invoiceUtils';
import { creatorSearchTerms, creatorSocialAccounts } from '../creatorSearchOptions';
import { matchPaymentRequestCreatorProfileLinks } from '../paymentRequestCreatorImport';
import type { CreatorProfile } from '../types';
import { Button, Modal, SelectField } from './Common';
import { CreatorIdentity } from './CreatorIdentity';
import { Pagination, usePagination } from './Pagination';
import './PaymentRequestCreatorAddModal.css';

type CreatorAddTab = 'LINKS' | 'ARCHIVE' | 'EXCEL';

export type PaymentRequestCreatorSelection = {
  creatorId: CreatorId;
  socialAccountId?: string;
};

export type PaymentRequestCreatorEligibility = {
  eligible: boolean;
  reason: string;
  availableInvoiceCount: number;
};

type ImportFeedback = {
  sourceName: string;
  addedCount: number;
  issues: string[];
};

const TABS: Array<{ value: CreatorAddTab; label: string; icon: typeof Users }> = [
  { value: 'LINKS', label: '粘贴链接', icon: ClipboardPaste },
  { value: 'ARCHIVE', label: '从达人档案库选择', icon: Users },
  { value: 'EXCEL', label: 'Excel 导入', icon: FileSpreadsheet },
];

const ImportResult = ({ feedback }: { feedback: ImportFeedback | null }) => {
  if (!feedback) return null;
  return (
    <section className="payment-request-creator-import-result" aria-live="polite">
      <div>
        <strong>{feedback.sourceName}</strong>
        <span>已加入待添加名单 {feedback.addedCount} 位</span>
      </div>
      {feedback.issues.length ? (
        <details>
          <summary>{feedback.issues.length} 项需要处理</summary>
          <ul>{feedback.issues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}</ul>
        </details>
      ) : <small>所有有效记录均已完成匹配。</small>}
    </section>
  );
};

export function PaymentRequestCreatorAddModal({
  requestCode,
  projectId,
  projectCode,
  projectName,
  creators,
  existingCreatorIds,
  projectReferences,
  eligibilityByCreatorId,
  onClose,
  onApply,
  onNotify,
}: {
  requestCode: string;
  projectId: ProjectId;
  projectCode: string;
  projectName: string;
  creators: CreatorProfile[];
  existingCreatorIds: CreatorId[];
  projectReferences: InvoiceBatchProjectCreatorReference[];
  eligibilityByCreatorId: Record<string, PaymentRequestCreatorEligibility>;
  onClose: () => void;
  onApply: (selection: PaymentRequestCreatorSelection[]) => void;
  onNotify: (title: string, message: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<CreatorAddTab>('LINKS');
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>({});
  const [linkInput, setLinkInput] = useState('');
  const [linkFeedback, setLinkFeedback] = useState<ImportFeedback | null>(null);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archivePlatform, setArchivePlatform] = useState('all');
  const [excelFeedback, setExcelFeedback] = useState<ImportFeedback | null>(null);
  const [importingExcel, setImportingExcel] = useState(false);
  const [draggingExcel, setDraggingExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const existingCreatorSet = useMemo(() => new Set(existingCreatorIds), [existingCreatorIds]);
  const selectedCreatorIds = Object.keys(selectedAccounts) as CreatorId[];

  const platformOptions = useMemo(() => {
    const platforms = Array.from(new Set(creators.flatMap((creator) => (
      creatorSocialAccounts(creator).map((account) => account.platform).filter(Boolean)
    )))).sort((left, right) => left.localeCompare(right));
    return [
      { value: 'all', label: '全部平台', description: `${creators.length} 位达人` },
      ...platforms.map((platform) => ({
        value: platform,
        label: platform,
        description: `${creators.filter((creator) => creatorSocialAccounts(creator).some((account) => account.platform === platform)).length} 位达人`,
      })),
    ];
  }, [creators]);

  const normalizedSearch = archiveSearch.trim().toLocaleLowerCase('en-US');
  const visibleCreators = useMemo(() => creators
    .filter((creator) => !normalizedSearch || creatorSearchTerms(creator).toLocaleLowerCase('en-US').includes(normalizedSearch))
    .filter((creator) => archivePlatform === 'all' || creatorSocialAccounts(creator).some((account) => account.platform === archivePlatform))
    .sort((left, right) => {
      const leftExisting = existingCreatorSet.has(left.id as CreatorId);
      const rightExisting = existingCreatorSet.has(right.id as CreatorId);
      if (leftExisting !== rightExisting) return leftExisting ? 1 : -1;
      const leftEligible = eligibilityByCreatorId[left.id]?.eligible ?? false;
      const rightEligible = eligibilityByCreatorId[right.id]?.eligible ?? false;
      if (leftEligible !== rightEligible) return leftEligible ? -1 : 1;
      return left.name.localeCompare(right.name);
    }), [archivePlatform, creators, eligibilityByCreatorId, existingCreatorSet, normalizedSearch]);

  const {
    page: archivePage,
    pageItems: archivePageItems,
    pageSize: archivePageSize,
    setPage: setArchivePage,
  } = usePagination(visibleCreators, {
    initialPageSize: 10,
    resetKey: `${archiveSearch}\u0000${archivePlatform}`,
  });

  const eligibilityIssue = (creatorId: CreatorId) => {
    if (existingCreatorSet.has(creatorId)) return '该达人已在当前请款中';
    return eligibilityByCreatorId[creatorId]?.eligible
      ? ''
      : eligibilityByCreatorId[creatorId]?.reason ?? '该达人当前不可加入请款';
  };

  const stageCandidates = (
    candidates: PaymentRequestCreatorSelection[],
    sourceIssues: string[] = [],
  ) => {
    const next = { ...selectedAccounts };
    const issues = [...sourceIssues];
    let addedCount = 0;
    candidates.forEach((candidate) => {
      const issue = eligibilityIssue(candidate.creatorId);
      const creator = creators.find((item) => item.id === candidate.creatorId);
      if (issue) {
        issues.push(`${creator?.name ?? candidate.creatorId}：${issue}`);
        return;
      }
      if (next[candidate.creatorId]) {
        issues.push(`${creator?.name ?? candidate.creatorId}：已在待添加名单中`);
        return;
      }
      const fallbackAccountId = creator ? creatorSocialAccounts(creator)[0]?.id : undefined;
      next[candidate.creatorId] = candidate.socialAccountId ?? fallbackAccountId ?? '';
      addedCount += 1;
    });
    setSelectedAccounts(next);
    return { addedCount, issues };
  };

  const reviewLinks = () => {
    const result = matchPaymentRequestCreatorProfileLinks({ value: linkInput, creators });
    const staged = stageCandidates(
      result.matches.map((match) => ({
        creatorId: match.creatorId,
        socialAccountId: match.socialAccountId,
      })),
      result.issues.map((issue) => issue.message),
    );
    setLinkFeedback({
      sourceName: '链接识别结果',
      addedCount: staged.addedCount,
      issues: linkInput.trim() ? staged.issues : ['请至少粘贴一条达人社媒主页链接'],
    });
  };

  const toggleArchiveCreator = (creator: CreatorProfile) => {
    const creatorId = creator.id as CreatorId;
    const issue = eligibilityIssue(creatorId);
    if (issue) {
      onNotify('暂不能选择该达人', issue);
      return;
    }
    setSelectedAccounts((current) => {
      const next = { ...current };
      if (creatorId in next) delete next[creatorId];
      else next[creatorId] = creatorSocialAccounts(creator)[0]?.id ?? '';
      return next;
    });
  };

  const downloadTemplate = async () => {
    try {
      const blob = await exportInvoiceBatchCreatorTemplate({ projectId, projectName });
      downloadBlob(blob, `COMETS-请款达人-${projectCode || projectId}.xlsx`);
    } catch {
      onNotify('模板下载失败', '当前无法生成达人导入模板，请稍后重试。');
    }
  };

  const importExcel = async (file: File) => {
    const basicIssues: string[] = [];
    if (!file.name.toLocaleLowerCase('en-US').endsWith('.xlsx')) {
      basicIssues.push('仅支持系统下载的 .xlsx 达人名单模板');
    } else if (!file.size || file.size > INVOICE_BATCH_CREATOR_IMPORT_MAX_FILE_SIZE) {
      basicIssues.push('文件不能为空，且大小不能超过 5 MB');
    }
    if (basicIssues.length) {
      setExcelFeedback({ sourceName: file.name || 'Excel 文件', addedCount: 0, issues: basicIssues });
      return;
    }

    setImportingExcel(true);
    try {
      const imported = await importInvoiceBatchCreatorTemplate(await file.arrayBuffer(), projectId);
      if (imported.fatal) {
        setExcelFeedback({
          sourceName: file.name,
          addedCount: 0,
          issues: imported.issues.map((issue) => issue.message),
        });
        return;
      }
      const matched = matchInvoiceBatchCreatorRows({
        rows: imported.rows,
        creators,
        projectReferences,
      });
      const staged = stageCandidates(
        matched.matches.map((match) => ({ creatorId: match.creatorId })),
        [...imported.issues, ...matched.issues].map((issue) => issue.message),
      );
      setExcelFeedback({
        sourceName: file.name,
        addedCount: staged.addedCount,
        issues: imported.rows.length ? staged.issues : [...staged.issues, '模板中没有填写达人信息'],
      });
    } catch (error) {
      setExcelFeedback({
        sourceName: file.name,
        addedCount: 0,
        issues: [error instanceof Error ? `模板解析失败：${error.message}` : '模板损坏或无法解析'],
      });
    } finally {
      setImportingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingExcel(false);
    const file = event.dataTransfer.files[0];
    if (file) void importExcel(file);
  };

  const applySelection = () => {
    onApply(selectedCreatorIds.map((creatorId) => ({
      creatorId,
      socialAccountId: selectedAccounts[creatorId] || undefined,
    })));
  };

  return (
    <Modal
      title={`添加达人 · ${requestCode}`}
      width="820px"
      className="payment-request-creator-add-modal"
      onClose={onClose}
      footer={(
        <>
          <span className="payment-request-creator-add-summary">待添加 <strong>{selectedCreatorIds.length}</strong> 位达人</span>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button
            disabled={!selectedCreatorIds.length}
            disabledReason="请先通过任一方式选择至少一位符合条件的达人。"
            onClick={applySelection}
          >添加选中达人（{selectedCreatorIds.length}）</Button>
        </>
      )}
    >
      <div className="payment-request-creator-add">
        <div className="payment-request-creator-add-context">
          <span><Users size={18} aria-hidden="true" /></span>
          <div><strong>{projectName}</strong><small>仅当前项目中存在未占用、已通过 Invoice 的达人可以加入请款</small></div>
          <em>{projectCode}</em>
        </div>

        <div className="payment-request-creator-add-tabs" role="tablist" aria-label="添加达人方式">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                id={`payment-request-creator-tab-${tab.value.toLocaleLowerCase('en-US')}`}
                className={activeTab === tab.value ? 'is-active' : ''}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.value}
                aria-controls={`payment-request-creator-panel-${tab.value.toLocaleLowerCase('en-US')}`}
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
              ><Icon size={15} aria-hidden="true" />{tab.label}</button>
            );
          })}
        </div>

        {activeTab === 'LINKS' ? (
          <section
            id="payment-request-creator-panel-links"
            className="payment-request-creator-add-panel payment-request-link-panel"
            role="tabpanel"
            aria-labelledby="payment-request-creator-tab-links"
          >
            <label htmlFor="payment-request-creator-links">每行粘贴一个达人社媒主页链接</label>
            <textarea
              id="payment-request-creator-links"
              autoFocus
              value={linkInput}
              placeholder={'支持的格式：\nhttps://www.youtube.com/@username\nhttps://www.tiktok.com/@username\nhttps://www.instagram.com/username\nhttps://www.facebook.com/pagename\nhttps://x.com/username'}
              onChange={(event) => {
                setLinkInput(event.target.value);
                setLinkFeedback(null);
              }}
            />
            <div className="payment-request-link-actions">
              <small>系统会按达人档案中的频道链接匹配，重复达人自动去重。</small>
              <Button variant="secondary" icon={<Search size={15} />} onClick={reviewLinks}>识别并加入选择</Button>
            </div>
            <ImportResult feedback={linkFeedback} />
          </section>
        ) : null}

        {activeTab === 'ARCHIVE' ? (
          <section
            id="payment-request-creator-panel-archive"
            className="payment-request-creator-add-panel payment-request-archive-panel"
            role="tabpanel"
            aria-labelledby="payment-request-creator-tab-archive"
          >
            <div className="payment-request-creator-archive-toolbar">
              <label className="payment-request-creator-archive-search">
                <Search size={16} aria-hidden="true" />
                <input
                  aria-label="搜索达人档案库"
                  placeholder="搜索 Display Name、Handle、平台或频道链接"
                  value={archiveSearch}
                  onChange={(event) => setArchiveSearch(event.target.value)}
                />
              </label>
              <SelectField
                ariaLabel="筛选达人社媒平台"
                variant="form"
                value={archivePlatform}
                options={platformOptions}
                onChange={setArchivePlatform}
              />
            </div>
            <div className="payment-request-creator-archive-table-wrap">
              <table className="payment-request-creator-archive-table">
                <thead><tr><th>达人</th><th>选择</th></tr></thead>
                <tbody>
                  {archivePageItems.map((creator) => {
                    const creatorId = creator.id as CreatorId;
                    const issue = eligibilityIssue(creatorId);
                    const selected = creatorId in selectedAccounts;
                    const existing = existingCreatorSet.has(creatorId);
                    const accounts = creatorSocialAccounts(creator);
                    const orderedAccounts = archivePlatform === 'all'
                      ? accounts
                      : [...accounts].sort((left, right) => Number(right.platform === archivePlatform) - Number(left.platform === archivePlatform));
                    const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
                      if (!['Enter', ' '].includes(event.key)) return;
                      event.preventDefault();
                      toggleArchiveCreator(creator);
                    };
                    return (
                      <tr
                        className={`${selected || existing ? 'is-selected' : ''}${issue && !existing ? ' is-unavailable' : ''}`}
                        key={creator.id}
                        tabIndex={0}
                        aria-label={`${creator.name}，${issue || (selected ? '已选择' : '可选择')}`}
                        title={issue || undefined}
                        onClick={() => toggleArchiveCreator(creator)}
                        onKeyDown={onRowKeyDown}
                      >
                        <td>
                          <CreatorIdentity
                            displayName={creator.name}
                            initials={creator.initials}
                            accent={creator.accent}
                            accounts={orderedAccounts}
                            socialAccountsMaxVisible={1}
                            size="md"
                          />
                        </td>
                        <td>
                          <button
                            className="payment-request-creator-select-control"
                            type="button"
                            aria-label={existing ? `${creator.name} 已在当前请款中` : selected ? `取消选择 ${creator.name}` : `选择 ${creator.name}`}
                            aria-pressed={selected || existing}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleArchiveCreator(creator);
                            }}
                          >
                            {selected || existing
                              ? <CheckCircle2 size={19} aria-hidden="true" />
                              : <Circle size={19} aria-hidden="true" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!archivePageItems.length ? <div className="payment-request-creator-archive-empty">没有找到匹配的达人档案</div> : null}
            </div>
            <div className="payment-request-creator-archive-pagination">
              <span>共 {visibleCreators.length} 位达人</span>
              <Pagination
                page={archivePage}
                pageSize={archivePageSize}
                total={visibleCreators.length}
                onPageChange={setArchivePage}
                pageSizeOptions={[10]}
                ariaLabel="达人档案库分页"
              />
            </div>
          </section>
        ) : null}

        {activeTab === 'EXCEL' ? (
          <section
            id="payment-request-creator-panel-excel"
            className="payment-request-creator-add-panel payment-request-excel-panel"
            role="tabpanel"
            aria-labelledby="payment-request-creator-tab-excel"
          >
            <div className="payment-request-excel-toolbar">
              <Button variant="secondary" icon={<Download size={15} />} onClick={() => { void downloadTemplate(); }}>下载导入模板</Button>
              <span>填写“频道ID / Display Name / 频道链接”中的任意一项后上传</span>
            </div>
            <input
              ref={fileInputRef}
              className="payment-request-excel-file-input"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importExcel(file);
              }}
            />
            <div
              className={`payment-request-excel-dropzone${draggingExcel ? ' is-dragging' : ''}`}
              role="button"
              tabIndex={0}
              aria-label="选择或拖拽 Excel 达人名单"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (!['Enter', ' '].includes(event.key)) return;
                event.preventDefault();
                fileInputRef.current?.click();
              }}
              onDragEnter={(event) => { event.preventDefault(); setDraggingExcel(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { event.preventDefault(); setDraggingExcel(false); }}
              onDrop={handleDrop}
            >
              {importingExcel ? <LoaderCircle className="is-spinning" size={38} aria-hidden="true" /> : <UploadCloud size={38} aria-hidden="true" />}
              <strong>{importingExcel ? '正在解析达人名单' : '点击或拖拽 Excel 文件到此处'}</strong>
              <span>仅支持系统下载的 .xlsx 模板，文件不超过 5 MB</span>
            </div>
            <ImportResult feedback={excelFeedback} />
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
