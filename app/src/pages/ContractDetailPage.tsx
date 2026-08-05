import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  Landmark,
  Pencil,
  ReceiptText,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, PageHeading } from '../components/Common';
import { ContractDocumentView } from '../components/ContractDocumentView';
import {
  canConfirmRecognitionFields,
  confirmRecognitionFields,
  editRecognitionField,
  reopenRecognitionFields,
} from '../contractRecognition';
import {
  CONTRACT_DOCUMENT_TYPE_LABELS,
  PAYMENT_FIELD_KEYS,
  SUMMARY_FIELD_KEYS,
  type ContractFieldCandidate,
  type ContractFieldKey,
  type ContractRecognitionField,
  type ContractSourceLocation,
} from '../contractRecognitionTypes';
import {
  applyConfirmedRecognitionToContract,
  formatContractMoney,
  getContractReadiness,
  type ContractRecord,
} from '../contracts';

type ContractDetailTab = 'summary' | 'io' | 'payment' | 'checks';
type Notify = (title: string, message: string) => void;

const FEE_BEARER_LABELS = {
  ADVERTISER: 'Advertiser承担',
  PUBLISHER: 'Publisher承担',
  SHARED: '双方共同承担',
  '': '待选择',
} as const;

const PAYMENT_METHOD_LABELS = {
  BANK: '银行转账',
  PAYPAL: 'PayPal',
  AIRWALLEX: 'Airwallex',
  '': '待选择',
} as const;

const FIELD_STATUS_LABELS = {
  detected: '待确认',
  missing: '待补充',
  conflict: '需核对',
  confirmed: '已确认',
} as const;

const sourceLabel = (source: ContractSourceLocation | null) => {
  if (!source) return '未找到可靠来源';
  const documentLabel = source.documentId === 'system-contract'
    ? '系统字段'
    : CONTRACT_DOCUMENT_TYPE_LABELS[source.documentType];
  return source.pageNumber
    ? `${documentLabel} · 第 ${source.pageNumber} 页`
    : `${documentLabel} · ${source.section}`;
};

function ContractDefinitionList({ contract }: { contract: ContractRecord }) {
  return (
    <dl className="contract-definition-list">
      <div><dt>Advertiser</dt><dd>{contract.advertiser || '待识别'}<small>Standard Terms · 第1页</small></dd></div>
      <div><dt>Publisher</dt><dd>{contract.publisher || '待补充'}<small>Standard Terms · 第1页</small></dd></div>
      <div><dt>合同编号</dt><dd>{contract.id}<small>系统字段</small></dd></div>
      <div><dt>IO编号</dt><dd>{contract.ioId}<small>IO · 第13页</small></dd></div>
      <div><dt>项目 / 品牌</dt><dd>{contract.project} · {contract.brand}<small>IO · 第13页</small></dd></div>
      <div><dt>平台 / 频道</dt><dd>{contract.platform || '待补充'} · {contract.channelName || '待补充'}<small>IO · 第14页</small></dd></div>
      <div><dt>生效日期</dt><dd>{contract.effectiveDate || '待补充'}<small>签署页 / IO</small></dd></div>
      <div><dt>Campaign Period</dt><dd>{contract.campaignStart && contract.campaignEnd ? `${contract.campaignStart} 至 ${contract.campaignEnd}` : '待补充'}<small>IO · 第13页</small></dd></div>
    </dl>
  );
}

function RecognitionFieldList({
  fields,
  fieldKeys,
  onChange,
  onSelectCandidate,
  onOpenSource,
  recognitionLocked = false,
}: {
  fields: ContractRecognitionField[];
  fieldKeys: ContractFieldKey[];
  onChange: (fieldKey: ContractFieldKey, value: string) => void;
  onSelectCandidate: (fieldKey: ContractFieldKey, candidate: ContractFieldCandidate) => void;
  onOpenSource: (source: ContractSourceLocation) => void;
  recognitionLocked?: boolean;
}) {
  return (
    <div className="contract-recognition-detail-list">
      {fieldKeys.map((fieldKey) => {
        const field = fields.find((item) => item.fieldKey === fieldKey);
        if (!field) return null;
        const fieldLocked = recognitionLocked || field.status === 'confirmed';
        return (
          <article
            className={`contract-recognition-detail contract-recognition-field-${field.status}${fieldLocked ? ' contract-recognition-detail-readonly' : ''}`}
            key={field.fieldKey}
          >
            <div className="contract-recognition-label">{field.label}</div>
            <div className="contract-recognition-value">
              <input
                aria-label={field.label}
                value={field.rawValue}
                placeholder="待补充"
                readOnly={fieldLocked}
                onChange={(event) => onChange(field.fieldKey, event.target.value)}
              />
              {field.source ? (
                <button className="contract-recognition-source" type="button" onClick={() => onOpenSource(field.source!)}>
                  <FileSearch size={12} />
                  {sourceLabel(field.source)}
                </button>
              ) : <small className="contract-recognition-missing-source">未识别，需人工补充</small>}
              {field.status === 'conflict' && field.candidates.length > 1 ? (
                <div className="contract-recognition-candidates">
                  <strong><AlertTriangle size={13} />发现多个候选，请选择后确认</strong>
                  {field.candidates.map((candidate, index) => (
                    <button type="button" key={`${candidate.source.blockId}-${index}`} onClick={() => onSelectCandidate(field.fieldKey, candidate)}>
                      <span>{candidate.rawValue}</span>
                      <small>{sourceLabel(candidate.source)}</small>
                    </button>
                  ))}
                </div>
              ) : null}
              {field.profileComparison?.status === 'conflict' ? (
                <div className="contract-recognition-profile-conflict">
                  <AlertTriangle size={13} />
                  <span>与达人档案账户不一致：{field.profileComparison.referenceLabels.join('、')}。合同值仅用于比对，不会覆盖达人档案。</span>
                </div>
              ) : null}
            </div>
            <div className="contract-recognition-actions">
              <span className="contract-recognition-status">{FIELD_STATUS_LABELS[field.status]}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function ContractDetailPage({
  contract,
  onBack,
  backLabel = '返回合同列表',
  notify,
  onUpdateContract,
}: {
  contract: ContractRecord;
  onBack: () => void;
  backLabel?: string;
  notify: Notify;
  onUpdateContract?: (contract: ContractRecord) => void;
}) {
  const [activeTab, setActiveTab] = useState<ContractDetailTab>('summary');
  const [dismissedDocumentNoteId, setDismissedDocumentNoteId] = useState<string | null>(null);
  const [draftFields, setDraftFields] = useState(contract.recognitionResults ?? []);
  const [activeDocumentId, setActiveDocumentId] = useState(contract.sourceDocuments?.[0]?.id ?? '');
  const [focusedSource, setFocusedSource] = useState<ContractSourceLocation | null>(null);
  useEffect(() => {
    setDraftFields(contract.recognitionResults ?? []);
    setActiveDocumentId(contract.sourceDocuments?.[0]?.id ?? '');
    setFocusedSource(null);
  }, [contract.id]);
  const selectedDocument = useMemo(() => (
    contract.sourceDocuments?.find((document) => document.id === activeDocumentId)
    ?? contract.sourceDocuments?.[0]
  ), [activeDocumentId, contract.sourceDocuments]);
  const sourceName = selectedDocument?.fileName ?? contract.sourceName;
  const documentUrl = selectedDocument?.documentUrl ?? contract.documentUrl;
  const pageCount = selectedDocument?.pageCount ?? contract.pageCount;
  const isPdf = /\.pdf$/i.test(sourceName);
  const previewPage = focusedSource && focusedSource.documentId === selectedDocument?.id
    ? focusedSource.pageNumber
    : null;
  const previewUrl = `${documentUrl}#page=${previewPage ?? 1}&toolbar=1&navpanes=0&view=FitH`;
  const hasRecognition = draftFields.length > 0;
  const confirmedCount = draftFields.filter((field) => field.status === 'confirmed').length;
  const allConfirmed = hasRecognition && confirmedCount === draftFields.length;
  const recognitionApplied = contract.extractionStage === 'applied';
  const visibleIssues = allConfirmed
    ? contract.issues.filter((issue) => issue.id !== 'recognition-review')
    : contract.issues;
  const readiness = getContractReadiness({ ...contract, issues: visibleIssues });
  const recognitionPageState = (fieldKeys: readonly ContractFieldKey[]) => {
    const pageFields = fieldKeys
      .map((fieldKey) => draftFields.find((field) => field.fieldKey === fieldKey))
      .filter((field): field is ContractRecognitionField => Boolean(field));
    return {
      confirmedCount: pageFields.filter((field) => field.status === 'confirmed').length,
      fieldCount: pageFields.length,
      allConfirmed: pageFields.length > 0 && pageFields.every((field) => field.status === 'confirmed'),
      canConfirm: canConfirmRecognitionFields(draftFields, fieldKeys),
    };
  };
  const summaryPageState = recognitionPageState(SUMMARY_FIELD_KEYS);
  const paymentPageState = recognitionPageState(PAYMENT_FIELD_KEYS);
  const tabs: Array<{ id: ContractDetailTab; label: string }> = [
    { id: 'summary', label: '合同摘要' },
    { id: 'io', label: 'IO与履约' },
    { id: 'payment', label: '付款与Invoice' },
    { id: 'checks', label: `校验记录${visibleIssues.length ? ` ${visibleIssues.length}` : ''}` },
  ];

  const copyContractId = async () => {
    await navigator.clipboard.writeText(contract.id);
    notify('合同编号已复制', contract.id);
  };

  const updateField = (fieldKey: ContractFieldKey, value: string) => {
    setDraftFields((current) => current.map((field) => (
      field.fieldKey === fieldKey ? editRecognitionField(field, value) : field
    )));
  };

  const confirmPage = (fieldKeys: readonly ContractFieldKey[], pageLabel: string) => {
    if (recognitionApplied) return;
    if (!canConfirmRecognitionFields(draftFields, fieldKeys)) {
      notify('本页仍有待处理字段', `${pageLabel}存在待补充或需核对字段，请处理后再确认。`);
      return;
    }
    const next = confirmRecognitionFields(draftFields, fieldKeys);
    setDraftFields(next);
    onUpdateContract?.({
      ...contract,
      recognitionResults: next,
      extractionStage: next.every((field) => field.status === 'confirmed') ? 'confirmed' : 'review',
    });
    notify('本页字段已确认', `${pageLabel}的字段信息已统一确认。`);
  };

  const editPage = (fieldKeys: readonly ContractFieldKey[], pageLabel: string) => {
    if (recognitionApplied) return;
    const next = reopenRecognitionFields(draftFields, fieldKeys);
    setDraftFields(next);
    onUpdateContract?.({
      ...contract,
      recognitionResults: next,
      extractionStage: 'review',
    });
    notify('本页已进入编辑状态', `${pageLabel}字段修改后需要重新确认。`);
  };

  const renderPageAction = (
    fieldKeys: readonly ContractFieldKey[],
    pageLabel: string,
    pageState: { allConfirmed: boolean; canConfirm: boolean },
  ) => {
    if (!hasRecognition || !onUpdateContract) return null;
    if (pageState.allConfirmed) {
      return recognitionApplied ? (
        <span className="contract-page-applied">
          <CheckCircle2 size={14} />
          已应用
        </span>
      ) : (
        <button
          className="contract-page-confirm contract-page-edit"
          type="button"
          onClick={() => editPage(fieldKeys, pageLabel)}
        >
          <Pencil size={14} />
          编辑
        </button>
      );
    }
    return (
      <button
        className="contract-page-confirm"
        type="button"
        disabled={!pageState.canConfirm}
        onClick={() => confirmPage(fieldKeys, pageLabel)}
      >
        <CheckCircle2 size={14} />
        确认本页
      </button>
    );
  };

  const selectCandidate = (fieldKey: ContractFieldKey, candidate: ContractFieldCandidate) => {
    setDraftFields((current) => current.map((field) => field.fieldKey === fieldKey
      ? {
          ...field,
          rawValue: candidate.rawValue,
          normalizedValue: candidate.normalizedValue,
          source: candidate.source,
          confidence: candidate.confidence,
          status: 'detected',
        }
      : field));
    setActiveDocumentId(candidate.source.documentId);
    setFocusedSource(candidate.source);
  };

  const openSource = (source: ContractSourceLocation) => {
    if (source.documentId !== 'system-contract') setActiveDocumentId(source.documentId);
    setFocusedSource(source);
  };

  const applyRecognition = () => {
    const candidate = { ...contract, recognitionResults: draftFields };
    const applied = applyConfirmedRecognitionToContract(candidate);
    if (!applied) {
      notify('仍有字段未确认', `已确认 ${confirmedCount}/${draftFields.length} 项，请完成各页字段确认。`);
      return;
    }
    onUpdateContract?.(applied);
    notify('合同资料已确认', '上传文件和结构化字段已确认为最终合同版本，现在可以参与 Invoice 校验。');
  };

  return (
    <div className="page-stack contract-detail-page">
      <button className="project-back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        {backLabel}
      </button>

      <PageHeading
        title={contract.name}
        subtitle={`${contract.id} · ${contract.templateFamily}`}
        actions={(
          <>
            <Button variant="secondary" icon={<Clipboard size={16} />} onClick={copyContractId}>复制编号</Button>
            {documentUrl ? (
              <a className="button button-primary contract-file-action" href={documentUrl} download={sourceName}>
                <Download size={16} />
                <span>下载当前文件</span>
              </a>
            ) : null}
          </>
        )}
      />

      <div className="contract-metric-grid">
        <article>
          <span>付款就绪度</span>
          <strong className={readiness.ready ? 'contract-ready-text' : 'contract-attention-text'}>{readiness.label}</strong>
          <small>{readiness.ready ? '可加入新建付款项目' : '完成阻断项后才能进入付款流程'}</small>
        </article>
        <article>
          <span>合同金额</span>
          <strong>{formatContractMoney(contract)}</strong>
          <small>{hasRecognition && contract.extractionStage !== 'applied' ? '识别结果尚未应用到正式字段' : '以人工确认后的正式字段为准'}</small>
        </article>
        <article>
          <span>合同状态</span>
          <strong>{contract.status}</strong>
          <small>{contract.lifecycle === 'GENERATED_DRAFT' ? '等待线下补充并回传' : contract.signed ? '上传最终版本已确认' : '上传版本待人工确认'}</small>
        </article>
      </div>

      {contract.documentNote && dismissedDocumentNoteId !== contract.id ? (
        <div className="contract-document-note" role="note">
          <FileSearch size={17} />
          <span>{contract.documentNote}</span>
          <button className="icon-button contract-document-note-close" type="button" aria-label="关闭合同预览提示" onClick={() => setDismissedDocumentNoteId(contract.id)}>
            <X size={17} />
          </button>
        </div>
      ) : null}

      <div className="contract-reader-layout">
        <section className="contract-document-panel">
          <header>
            <div>
              <FileText size={19} />
              <span><strong>合同全文</strong><small>{sourceName}{pageCount ? ` · ${pageCount}页` : ''}</small></span>
            </div>
            {documentUrl ? <a href={documentUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />新窗口打开</a> : null}
          </header>
          {contract.sourceDocuments && contract.sourceDocuments.length > 1 ? (
            <div className="contract-document-switcher" role="tablist" aria-label="合同文件">
              {contract.sourceDocuments.map((document) => (
                <button
                  className={selectedDocument?.id === document.id ? 'active' : ''}
                  type="button"
                  role="tab"
                  aria-selected={selectedDocument?.id === document.id}
                  key={document.id}
                  onClick={() => { setActiveDocumentId(document.id); setFocusedSource(null); }}
                >
                  {document.fileName}
                </button>
              ))}
            </div>
          ) : null}
          {documentUrl && isPdf ? (
            <iframe className="contract-pdf-frame" src={previewUrl} title={`${contract.name} PDF原文`} />
          ) : documentUrl && selectedDocument ? (
            <div className="contract-document-canvas contract-document-download-only">
              <FileText size={32} />
              {focusedSource?.documentId === selectedDocument.id ? (
                <>
                  <strong>{focusedSource.section || 'DOCX 原文位置'}</strong>
                  <p className="contract-docx-source-text">{focusedSource.sourceText}</p>
                </>
              ) : (
                <>
                  <strong>DOCX 已在浏览器本地解析</strong>
                  <p>点击右侧字段来源可查看对应章节和原文；完整排版请下载原文件查看。</p>
                </>
              )}
            </div>
          ) : (
            <div className="contract-document-canvas">
              <ContractDocumentView contract={contract} ariaLabel={`${contract.id} 合同全文`} />
            </div>
          )}
        </section>

        <section className="contract-inspector">
          <div className="contract-tabs" role="tablist" aria-label="合同详情分类">
            {tabs.map((tab) => (
              <button className={activeTab === tab.id ? 'contract-tab-active' : ''} type="button" role="tab" aria-selected={activeTab === tab.id} key={tab.id} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="contract-inspector-content">
            {activeTab === 'summary' ? (
              <>
                <div className="contract-section-heading">
                  <FileSearch size={18} />
                  <span>
                    <strong>结构化合同信息</strong>
                    <small>{hasRecognition ? `本页已确认 ${summaryPageState.confirmedCount}/${summaryPageState.fieldCount} 项` : '每个字段保留合同来源位置'}</small>
                  </span>
                  {renderPageAction(SUMMARY_FIELD_KEYS, '合同摘要', summaryPageState)}
                </div>
                {hasRecognition ? (
                  <RecognitionFieldList
                    fields={draftFields}
                    fieldKeys={SUMMARY_FIELD_KEYS}
                    onChange={updateField}
                    onSelectCandidate={selectCandidate}
                    onOpenSource={openSource}
                    recognitionLocked={recognitionApplied}
                  />
                ) : <ContractDefinitionList contract={contract} />}
                {contract.channelLink ? <a className="contract-channel-link" href={contract.channelLink} target="_blank" rel="noreferrer"><ExternalLink size={15} />查看达人社媒账号主页</a> : null}
              </>
            ) : null}

            {activeTab === 'io' ? (
              <>
                <div className="contract-section-heading">
                  <CalendarDays size={18} />
                  <span><strong>IO与履约要求</strong><small>用于后续验收与应付金额确认</small></span>
                </div>
                {contract.deliverables.length > 0 ? (
                  <div className="contract-deliverable-list">
                    {contract.deliverables.map((deliverable, index) => (
                      <article key={deliverable.id}>
                        <span>{index + 1}</span>
                        <div><strong>{deliverable.title}</strong><p>{deliverable.description}</p><small>{deliverable.source}</small></div>
                      </article>
                    ))}
                  </div>
                ) : <div className="contract-inline-empty">当前合同尚未录入结构化交付要求。</div>}
              </>
            ) : null}

            {activeTab === 'payment' ? (
              <>
                <div className="contract-section-heading">
                  <ReceiptText size={18} />
                  <span>
                    <strong>付款与Invoice规则</strong>
                    <small>{hasRecognition ? `本页已确认 ${paymentPageState.confirmedCount}/${paymentPageState.fieldCount} 项` : '账户识别值仅用于与达人档案人工比对'}</small>
                  </span>
                  {renderPageAction(PAYMENT_FIELD_KEYS, '付款与Invoice', paymentPageState)}
                </div>
                {hasRecognition ? (
                  <RecognitionFieldList
                    fields={draftFields}
                    fieldKeys={PAYMENT_FIELD_KEYS}
                    onChange={updateField}
                    onSelectCandidate={selectCandidate}
                    onOpenSource={openSource}
                    recognitionLocked={recognitionApplied}
                  />
                ) : (
                  <dl className="contract-payment-list">
                    <div><dt>Project Total Fees</dt><dd>{formatContractMoney(contract)}</dd></div>
                    <div><dt>Invoice开具期限</dt><dd>{contract.invoiceWithinWorkingDays ? `最终验收后${contract.invoiceWithinWorkingDays}个工作日内` : '待补充'}</dd></div>
                    <div><dt>付款期限</dt><dd>{contract.paymentWithinWorkingDays ? `发布、验收且收到Invoice后${contract.paymentWithinWorkingDays}个工作日` : '待选择'}</dd></div>
                    <div><dt>付款方式</dt><dd>{PAYMENT_METHOD_LABELS[contract.paymentMethod]}</dd></div>
                    <div><dt>转账费用</dt><dd>{FEE_BEARER_LABELS[contract.feeBearer]}</dd></div>
                    <div><dt>合同账户快照</dt><dd>{contract.accountName ? `${contract.accountName} · ${contract.accountFingerprint}` : '待补充'}</dd></div>
                    <div>
                      <dt>账户渠道 / 版本</dt>
                      <dd>
                        {contract.payoutProvider
                          ? `${contract.payoutProvider} · ${contract.payoutAccountVersion ?? 'legacy-v1'}`
                          : contract.accountName || contract.accountFingerprint
                            ? `渠道待补充 · ${contract.payoutAccountVersion ?? 'legacy-v1'}`
                            : '待补充'}
                      </dd>
                    </div>
                  </dl>
                )}
                <div className="contract-payment-rule">
                  <Landmark size={17} />
                  <span>合同账户不得自动覆盖达人档案中的已验证 Beneficiary；不一致时必须人工核对。</span>
                </div>
              </>
            ) : null}

            {activeTab === 'checks' ? (
              <>
                <div className="contract-section-heading">
                  <ShieldCheck size={18} />
                  <span><strong>合同完整性检查</strong><small>阻断项未解决时不能加入付款项目</small></span>
                </div>
                {hasRecognition && contract.extractionStage !== 'applied' ? (
                  <div className={`contract-recognition-apply${allConfirmed ? ' contract-recognition-apply-complete' : ''}`}>
                    <span className="contract-recognition-apply-icon">
                      <CheckCircle2 size={17} />
                    </span>
                    <div><strong>人工确认进度</strong><small>{confirmedCount}/{draftFields.length} 项</small></div>
                    <Button disabled={!allConfirmed || !onUpdateContract} onClick={applyRecognition}>应用到正式合同资料</Button>
                  </div>
                ) : null}
                {visibleIssues.length > 0 ? (
                  <div className="contract-issue-list">
                    {visibleIssues.map((issue) => (
                      <article className={`contract-issue contract-issue-${issue.severity}`} key={issue.id}>
                        <span>{issue.severity === 'blocker' ? <AlertTriangle size={17} /> : <FileSearch size={17} />}</span>
                        <div><strong>{issue.label}</strong><p>{issue.description}</p><small>{issue.source}</small></div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="contract-check-success">
                    <CheckCircle2 size={22} />
                    <span><strong>关键字段检查通过</strong><small>合同可用于新建付款项目，并继续进行Invoice匹配。</small></span>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
