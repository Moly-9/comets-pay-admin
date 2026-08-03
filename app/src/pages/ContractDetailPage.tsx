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
  Save,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, PageHeading } from '../components/Common';
import { ContractDocumentView } from '../components/ContractDocumentView';
import { formatContractMoney, getContractReadiness, type ContractRecord } from '../contracts';

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
  '': '待选择',
} as const;

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
  const [editingFields, setEditingFields] = useState(false);
  const [draftFields, setDraftFields] = useState(contract.extractedFields ?? []);
  useEffect(() => setDraftFields(contract.extractedFields ?? []), [contract]);
  const canPreviewInline = Boolean(contract.documentUrl && /\.pdf$/i.test(contract.sourceName));
  const readiness = getContractReadiness(contract);
  const tabs: Array<{ id: ContractDetailTab; label: string }> = [
    { id: 'summary', label: '合同摘要' },
    { id: 'io', label: 'IO与履约' },
    { id: 'payment', label: '付款与Invoice' },
    { id: 'checks', label: `校验记录${contract.issues.length ? ` ${contract.issues.length}` : ''}` },
  ];

  const copyContractId = async () => {
    await navigator.clipboard.writeText(contract.id);
    notify('合同编号已复制', contract.id);
  };

  const confirmExtractedFields = () => {
    const missing = draftFields.filter((field) => field.required && !field.value.trim());
    if (missing.length > 0) {
      notify('仍有关键字段缺失', `请补充：${missing.map((field) => field.label).join('、')}`);
      return;
    }
    const valueFor = (key: string) => draftFields.find((field) => field.key === key)?.value.trim() ?? '';
    const amountText = valueFor('totalFee').replace(/,/g, '');
    const amount = Number(amountText.match(/\d+(?:\.\d+)?/)?.[0] ?? '');
    const paymentDays = Number(valueFor('paymentTerm').match(/\d+/)?.[0] ?? '');
    const updated: ContractRecord = {
      ...contract,
      advertiser: valueFor('advertiser') || contract.advertiser,
      publisher: valueFor('publisher') || contract.publisher,
      ioId: valueFor('ioId') || contract.ioId,
      currency: valueFor('currency').toUpperCase() || contract.currency,
      totalFee: Number.isFinite(amount) && amount > 0 ? amount : contract.totalFee,
      paymentWithinWorkingDays: Number.isFinite(paymentDays) && paymentDays > 0 ? paymentDays : contract.paymentWithinWorkingDays,
      extractedFields: draftFields,
      extractionStage: 'confirmed',
      status: contract.signed ? contract.status : '待签署',
      issues: contract.issues.filter((issue) => !issue.id.startsWith('missing-') && issue.id !== 'parsing'),
    };
    onUpdateContract?.(updated);
    setEditingFields(false);
    notify('合同字段已确认', '解析字段已保存；签署状态和付款就绪度未被改变。');
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
            {contract.documentUrl ? (
              <a className="button button-primary contract-file-action" href={contract.documentUrl} download={contract.sourceName}>
                <Download size={16} />
                <span>下载原文件</span>
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
          <small>{contract.licensePrice === null ? 'License费用未单列' : `License ${contract.currency} ${contract.licensePrice.toLocaleString('en-US')} · ${contract.licenseIncludedInTotal ? '已包含在总价' : '另行计算'}`}</small>
        </article>
        <article>
          <span>合同状态</span>
          <strong>{contract.status}</strong>
          <small>{contract.signed ? '签署状态已确认' : '尚未确认双方签署'}</small>
        </article>
      </div>

      {contract.documentNote && dismissedDocumentNoteId !== contract.id ? (
        <div className="contract-document-note" role="note">
          <FileSearch size={17} />
          <span>{contract.documentNote}</span>
          <button
            className="icon-button contract-document-note-close"
            type="button"
            aria-label="关闭合同预览提示"
            onClick={() => setDismissedDocumentNoteId(contract.id)}
          >
            <X size={17} />
          </button>
        </div>
      ) : null}

      <div className="contract-reader-layout">
        <section className="contract-document-panel">
          <header>
            <div>
              <FileText size={19} />
              <span><strong>合同全文</strong><small>{contract.sourceName}{contract.pageCount ? ` · ${contract.pageCount}页` : ''}</small></span>
            </div>
            {contract.documentUrl ? (
              <a href={contract.documentUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={15} />
                新窗口打开
              </a>
            ) : null}
          </header>
          {canPreviewInline ? (
            <iframe
              className="contract-pdf-frame"
              src={`${contract.documentUrl}#toolbar=1&navpanes=0&view=FitH`}
              title={`${contract.name} PDF原文`}
            />
          ) : contract.documentUrl ? (
            <div className="contract-document-canvas contract-document-download-only">
              <FileText size={32} />
              <strong>该 Word 文件需下载后查看</strong>
              <p>浏览器已完成可用字段的本地提取，但不会把 DOC 或 DOCX 伪装成 PDF 预览。</p>
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
              <button
                className={activeTab === tab.id ? 'contract-tab-active' : ''}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="contract-inspector-content">
            {activeTab === 'summary' ? (
              <>
                <div className="contract-section-heading">
                  <FileSearch size={18} />
                  <span><strong>结构化合同信息</strong><small>每个字段保留合同来源位置</small></span>
                  {contract.extractedFields?.length && onUpdateContract ? (
                    <Button
                      variant="secondary"
                      icon={editingFields ? <Save size={15} /> : <Pencil size={15} />}
                      onClick={editingFields ? confirmExtractedFields : () => setEditingFields(true)}
                    >
                      {editingFields ? '确认字段' : contract.extractionStage === 'confirmed' ? '编辑字段' : '复核字段'}
                    </Button>
                  ) : null}
                </div>
                {editingFields ? (
                  <div className="contract-field-review contract-field-review-detail">
                    {draftFields.map((field) => (
                      <label key={field.key}>
                        <span>{field.label}{field.required ? ' *' : ''}<small>{field.source}</small></span>
                        <input
                          value={field.value}
                          placeholder="待补充"
                          onChange={(event) => setDraftFields((current) => current.map((item) => item.key === field.key
                            ? { ...item, value: event.target.value, source: '人工复核' }
                            : item))}
                        />
                      </label>
                    ))}
                  </div>
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
                  <span><strong>付款与Invoice规则</strong><small>合同值将与Invoice及已验证账户逐项匹配</small></span>
                </div>
                <dl className="contract-payment-list">
                  <div><dt>Project Total Fees</dt><dd>{formatContractMoney(contract)}</dd></div>
                  <div><dt>Invoice开具期限</dt><dd>{contract.invoiceWithinWorkingDays ? `最终验收后${contract.invoiceWithinWorkingDays}个工作日内` : '待补充'}</dd></div>
                  <div><dt>付款期限</dt><dd>{contract.paymentWithinWorkingDays ? `发布、验收且收到Invoice后${contract.paymentWithinWorkingDays}个工作日` : '待选择'}</dd></div>
                  <div><dt>付款方式</dt><dd>{PAYMENT_METHOD_LABELS[contract.paymentMethod]}</dd></div>
                  <div><dt>转账费用</dt><dd>{FEE_BEARER_LABELS[contract.feeBearer]}</dd></div>
                  <div><dt>合同账户快照</dt><dd>{contract.accountName ? `${contract.accountName} · ${contract.accountFingerprint}` : '待补充'}</dd></div>
                </dl>
                <div className="contract-payment-rule">
                  <Landmark size={17} />
                  <span>实际付款使用达人档案中的已验证Beneficiary；合同账户用于与Invoice做一致性校验。</span>
                </div>
              </>
            ) : null}

            {activeTab === 'checks' ? (
              <>
                <div className="contract-section-heading">
                  <ShieldCheck size={18} />
                  <span><strong>合同完整性检查</strong><small>阻断项未解决时不能加入付款项目</small></span>
                </div>
                {contract.issues.length > 0 ? (
                  <div className="contract-issue-list">
                    {contract.issues.map((issue) => (
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
