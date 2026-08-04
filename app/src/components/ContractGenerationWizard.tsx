import { CheckCircle2, Download, FileText, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { contractGenerationFilename } from '../contractGenerationFilename';
import {
  createPrototypeCode,
  type CreatorId,
  type EngagementId,
  type ProjectId,
} from '../businessWorkflow';
import type {
  ContractGenerationModel,
  ContractRecord,
} from '../contracts';
import { downloadBlob } from '../invoice/invoiceUtils';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import type { CreatorProfile } from '../types';
import { Button, Modal, SelectField } from './Common';

type Props = {
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  onClose: () => void;
  onSave: (model: ContractGenerationModel) => ContractRecord;
  initialEngagementId?: EngagementId | null;
};

type GeneratedFiles = {
  record: ContractRecord;
  docxBlob: Blob;
  pdfBlob: Blob;
} | null;

const PAYMENT_METHOD_OPTIONS = [
  { value: '', label: '待线下补充' },
  { value: 'BANK', label: '银行转账' },
  { value: 'PAYPAL', label: 'PayPal' },
  { value: 'AIRWALLEX', label: 'Airwallex' },
];

const FEE_BEARER_OPTIONS = [
  { value: '', label: '待线下补充' },
  { value: 'ADVERTISER', label: 'Advertiser 承担' },
  { value: 'PUBLISHER', label: 'Publisher 承担' },
  { value: 'SHARED', label: '双方共同承担' },
];

const findInitialContext = (
  projects: ProjectSummary[],
  engagementId?: EngagementId | null,
) => {
  if (!engagementId) return { projectId: '', creatorId: '' };
  for (const project of projects) {
    const reference = project.creatorProfiles?.find((item) => item.engagementId === engagementId);
    if (reference) return { projectId: project.id, creatorId: reference.creatorId };
  }
  return { projectId: '', creatorId: '' };
};

export function ContractGenerationWizard({
  projects,
  creators,
  onClose,
  onSave,
  initialEngagementId,
}: Props) {
  const initial = findInitialContext(projects, initialEngagementId);
  const [projectCode, setProjectCode] = useState(initial.projectId);
  const [creatorId, setCreatorId] = useState(initial.creatorId);
  const [contractNumber] = useState(() => createPrototypeCode('CON'));
  const [ioNumber, setIoNumber] = useState('');
  const [advertiser, setAdvertiser] = useState('Comets International Limited');
  const [publisher, setPublisher] = useState('');
  const [platform, setPlatform] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelUrl, setChannelUrl] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [campaignStart, setCampaignStart] = useState('');
  const [campaignEnd, setCampaignEnd] = useState('');
  const [currency, setCurrency] = useState('');
  const [totalFee, setTotalFee] = useState('');
  const [invoiceIssuePeriod, setInvoiceIssuePeriod] = useState('');
  const [paymentTerm, setPaymentTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<ContractGenerationModel['paymentMethod']>('');
  const [feeBearer, setFeeBearer] = useState<ContractGenerationModel['feeBearer']>('');
  const [deliverables, setDeliverables] = useState('');
  const [additionalTerms, setAdditionalTerms] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState<GeneratedFiles>(null);

  const selectedProject = projects.find((project) => project.id === projectCode) ?? null;
  const projectReferences = selectedProject?.creatorProfiles ?? [];
  const selectedReference = projectReferences.find((reference) => reference.creatorId === creatorId) ?? null;
  const selectedCreator = creators.find((creator) => creator.id === creatorId) ?? null;
  const projectOptions = projects
    .filter((project) => (project.creatorProfiles?.length ?? 0) > 0)
    .map((project) => ({
      value: project.id,
      label: project.name,
      description: `${project.projectCode ?? project.id} · ${project.creatorProfiles?.length ?? 0} 位达人`,
    }));
  const creatorOptions = useMemo(() => projectReferences.map((reference) => ({
    value: reference.creatorId,
    label: reference.name,
    description: `${reference.handle} · ${reference.platform}`,
  })), [projectReferences]);

  const buildModel = (): ContractGenerationModel | null => {
    if (!selectedProject || !selectedCreator || !selectedReference) return null;
    return {
      templateId: 'CON-TPL-2026-KOL',
      projectId: (selectedProject.projectId ?? selectedProject.id) as ProjectId,
      projectName: selectedProject.name,
      brandName: selectedProject.brand,
      creatorId: selectedCreator.id as CreatorId,
      creatorName: selectedCreator.name,
      creatorHandle: selectedCreator.handle,
      engagementId: selectedReference.engagementId as EngagementId,
      contractNumber,
      ioNumber,
      advertiser,
      publisher,
      platform,
      channelName,
      channelUrl,
      effectiveDate,
      campaignStart,
      campaignEnd,
      currency,
      totalFee,
      invoiceIssuePeriod,
      paymentTerm,
      paymentMethod,
      feeBearer,
      deliverables,
      additionalTerms,
    };
  };

  const generate = async () => {
    const model = buildModel();
    if (!model) {
      setError('请选择合同所属项目和达人。');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const { generateContractFiles } = await import('../contractGeneration');
      const files = await generateContractFiles(model);
      const record = onSave(model);
      setGenerated({ record, ...files });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '合同文件生成失败，请稍后重试。');
    } finally {
      setGenerating(false);
    }
  };

  const download = (extension: 'docx' | 'pdf') => {
    const model = buildModel();
    if (!model || !generated) return;
    downloadBlob(
      extension === 'docx' ? generated.docxBlob : generated.pdfBlob,
      contractGenerationFilename(model, generated.record.generationVersion ?? 1, extension),
    );
  };

  return (
    <Modal
      title="生成合同"
      width="1040px"
      className="contract-generation-modal"
      onClose={onClose}
      footer={generated ? (
        <>
          <Button variant="secondary" icon={<Download size={16} />} onClick={() => download('docx')}>下载 DOCX</Button>
          <Button variant="secondary" icon={<Download size={16} />} onClick={() => download('pdf')}>下载 PDF</Button>
          <Button onClick={onClose}>完成</Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button disabled={generating} onClick={() => void generate()}>
            {generating ? '正在生成…' : '生成合同草稿'}
          </Button>
        </>
      )}
    >
      {generated ? (
        <div className="contract-generation-success">
          <CheckCircle2 size={28} />
          <div>
            <strong>{generated.record.id} 已生成</strong>
            <p>草稿已关联当前项目达人，等待媒介线下补充、签署后上传回传。</p>
          </div>
        </div>
      ) : (
        <form className="contract-generation-form" onSubmit={(event) => { event.preventDefault(); void generate(); }}>
          <section>
            <header><UserRound size={18} /><div><h3>关联信息</h3><p>项目和达人为必选项，其他合同字段均允许留空。</p></div></header>
            <div className="contract-generation-grid">
              <div className="invoice-form-control">
                <span>关联项目 *</span>
                <SelectField
                  ariaLabel="合同关联项目"
                  variant="form"
                  value={projectCode}
                  placeholder="选择项目"
                  options={projectOptions}
                  onChange={(value) => {
                    setProjectCode(value);
                    setCreatorId('');
                    setGenerated(null);
                  }}
                />
              </div>
              <div className="invoice-form-control">
                <span>合作达人 *</span>
                <SelectField
                  ariaLabel="合同合作达人"
                  variant="form"
                  value={creatorId}
                  placeholder={projectCode ? '选择项目达人' : '请先选择项目'}
                  options={creatorOptions}
                  disabled={!projectCode}
                  onChange={(value) => {
                    const creator = creators.find((item) => item.id === value);
                    setCreatorId(value);
                    setPublisher(creator?.contact.legalName ?? creator?.name ?? '');
                    setPlatform(creator?.platform ?? '');
                    setChannelName(creator?.handle ?? '');
                  }}
                />
              </div>
            </div>
          </section>

          <section>
            <header><FileText size={18} /><div><h3>合同字段</h3><p>空字段会在 DOCX 和 PDF 中保留可填写的空白区域。</p></div></header>
            <div className="contract-generation-grid">
              <label><span>合同编号</span><input value={contractNumber} readOnly /></label>
              <label><span>IO 编号</span><input value={ioNumber} onChange={(event) => setIoNumber(event.target.value)} /></label>
              <label><span>Advertiser</span><input value={advertiser} onChange={(event) => setAdvertiser(event.target.value)} /></label>
              <label><span>Publisher</span><input value={publisher} onChange={(event) => setPublisher(event.target.value)} /></label>
              <label><span>平台</span><input value={platform} onChange={(event) => setPlatform(event.target.value)} /></label>
              <label><span>频道名称</span><input value={channelName} onChange={(event) => setChannelName(event.target.value)} /></label>
              <label className="full-width"><span>Channel Link</span><input value={channelUrl} onChange={(event) => setChannelUrl(event.target.value)} /></label>
              <label><span>生效日期</span><input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} /></label>
              <label><span>Campaign Start</span><input type="date" value={campaignStart} onChange={(event) => setCampaignStart(event.target.value)} /></label>
              <label><span>Campaign End</span><input type="date" value={campaignEnd} onChange={(event) => setCampaignEnd(event.target.value)} /></label>
              <label><span>币种</span><input value={currency} placeholder="USD" onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></label>
              <label><span>Project Total Fees</span><input type="number" min="0" step="0.01" value={totalFee} onChange={(event) => setTotalFee(event.target.value)} /></label>
              <label><span>Invoice Issue Period</span><input value={invoiceIssuePeriod} onChange={(event) => setInvoiceIssuePeriod(event.target.value)} /></label>
              <label><span>Payment Term</span><input value={paymentTerm} onChange={(event) => setPaymentTerm(event.target.value)} /></label>
              <div className="invoice-form-control"><span>Payment Method</span><SelectField ariaLabel="合同付款方式" variant="form" value={paymentMethod} options={PAYMENT_METHOD_OPTIONS} onChange={(value) => setPaymentMethod(value as ContractGenerationModel['paymentMethod'])} /></div>
              <div className="invoice-form-control"><span>Transfer Fee Bearer</span><SelectField ariaLabel="合同手续费承担" variant="form" value={feeBearer} options={FEE_BEARER_OPTIONS} onChange={(value) => setFeeBearer(value as ContractGenerationModel['feeBearer'])} /></div>
              <label className="full-width"><span>Services / Deliverables</span><textarea rows={4} value={deliverables} onChange={(event) => setDeliverables(event.target.value)} /></label>
              <label className="full-width"><span>Additional Terms</span><textarea rows={3} value={additionalTerms} onChange={(event) => setAdditionalTerms(event.target.value)} /></label>
            </div>
          </section>
          {error ? <div className="invoice-builder-error" role="alert"><strong>无法生成合同</strong><span>{error}</span></div> : null}
        </form>
      )}
    </Modal>
  );
}
