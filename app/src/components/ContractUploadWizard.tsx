import { AlertTriangle, Check, FileText, Search, Upload, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  createSelectedContractFiles,
  MAX_CONTRACT_FILE_COUNT,
  parseContractFiles,
  type SelectedContractFile,
  validateContractFile,
} from '../contractParserClient';
import { recognizeContractFields } from '../contractRecognition';
import {
  CONTRACT_DOCUMENT_TYPE_LABELS,
  type ContractDocumentType,
  type ContractRecognitionField,
  type ParsedContractDocument,
} from '../contractRecognitionTypes';
import type { ContractUploadInput } from '../contracts';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import type { CreatorProfile } from '../types';
import { Button, Modal } from './Common';

type Props = {
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  onClose: () => void;
  onSave: (input: ContractUploadInput) => void;
};

const STATUS_LABELS = {
  parsed: '解析完成',
  scanned: '疑似扫描件',
  encrypted: '文件已加密',
  corrupt: '文件损坏',
} as const;

const FIELD_STATUS_LABELS = {
  detected: '待确认',
  missing: '待补充',
  conflict: '需核对',
  confirmed: '已确认',
} as const;

const createSystemContractNumber = () => `CON-UPL-${Date.now().toString().slice(-7)}`;

export function ContractUploadWizard({ projects, creators, onClose, onSave }: Props) {
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState('');
  const [creatorId, setCreatorId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedContractFile[]>([]);
  const [documents, setDocuments] = useState<ParsedContractDocument[]>([]);
  const [fields, setFields] = useState<ContractRecognitionField[]>([]);
  const [systemContractNumber] = useState(createSystemContractNumber);
  const [error, setError] = useState('');
  const [parsing, setParsing] = useState(false);
  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const visibleProjects = projects.filter((project) => (
    `${project.name}${project.id}${project.brand}`.toLowerCase().includes(search.trim().toLowerCase())
  ));
  const projectCreators = useMemo(() => {
    if (!selectedProject) return [];
    const references = selectedProject.creatorProfiles ?? [];
    return references
      .map((reference) => creators.find((creator) => creator.id === reference.creatorId))
      .filter((creator): creator is CreatorProfile => Boolean(creator));
  }, [creators, selectedProject]);
  const selectedCreator = projectCreators.find((creator) => creator.id === creatorId) ?? null;
  const beneficiaryReferences = useMemo(() => selectedCreator?.payoutAccounts.map((account) => {
    if (account.provider === 'PayPal') {
      return {
        label: `PayPal · ${account.paypalEmail}`,
        matchTokens: [account.paypalEmail, account.paypalUsername],
      };
    }
    if (account.provider === 'PayMax') {
      return {
        label: `PayerMax · ${account.beneficiaryName || account.nickname}`,
        matchTokens: [account.beneficiaryName, account.payermaxAccountId],
      };
    }
    const accountNumber = account.bankDetails.iban || account.bankDetails.accountNumber;
    return {
      label: `${account.bankDetails.accountName || account.nickname} · •••• ${accountNumber.replace(/\s/g, '').slice(-4)}`,
      matchTokens: [account.bankDetails.accountName, accountNumber.slice(-4)],
    };
  }) ?? [], [selectedCreator]);

  const parseSelection = async (files: SelectedContractFile[]) => {
    setError('');
    setParsing(true);
    try {
      const parsed = await parseContractFiles(files);
      setSelectedFiles(files);
      setDocuments(parsed);
      setFields(recognizeContractFields(parsed, { systemContractNumber, beneficiaryReferences }));
      setStep(4);
    } catch (reason) {
      setDocuments([]);
      setFields([]);
      setError(reason instanceof Error ? reason.message : '合同解析失败，请检查文件后重试。');
    } finally {
      setParsing(false);
    }
  };

  const selectFiles = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    if (files.length > MAX_CONTRACT_FILE_COUNT) {
      setError(`一次最多上传 ${MAX_CONTRACT_FILE_COUNT} 份合同文件。`);
      return;
    }
    const invalid = files.map((file) => ({ file, message: validateContractFile(file) })).find((item) => item.message);
    if (invalid) {
      setError(`${invalid.file.name}：${invalid.message}`);
      return;
    }
    void parseSelection(createSelectedContractFiles(files));
  };

  const changeDocumentType = (documentId: string, documentType: ContractDocumentType) => {
    const nextSelected = selectedFiles.map((item) => item.id === documentId ? { ...item, documentType } : item);
    const nextDocuments = documents.map((document) => (
      document.id === documentId ? { ...document, documentType } : document
    ));
    setSelectedFiles(nextSelected);
    setDocuments(nextDocuments);
    setFields(recognizeContractFields(nextDocuments, { systemContractNumber, beneficiaryReferences }));
  };

  const save = () => {
    if (!selectedProject || !selectedCreator || !selectedFiles.length || !documents.length) return;
    const reference = selectedProject.creatorProfiles?.find((creator) => creator.creatorId === selectedCreator.id);
    const sourceDocuments = documents.map((document) => {
      const selected = selectedFiles.find((item) => item.id === document.id);
      return {
        ...document,
        documentUrl: selected ? URL.createObjectURL(selected.file) : '',
      };
    });
    onSave({
      systemContractNumber,
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      customer: selectedProject.brand,
      creatorId: selectedCreator.id,
      creatorName: selectedCreator.name,
      creatorHandle: selectedCreator.handle,
      creatorPlatform: selectedCreator.platform,
      engagementId: reference?.engagementId ?? `ENG-${selectedProject.id}-${selectedCreator.id}`,
      recognitionResults: fields,
      sourceDocuments,
    });
  };

  return (
    <Modal
      title="上传合同"
      onClose={onClose}
      width="920px"
      footer={(
        <>
          {step > 1 && step < 5 && !parsing ? <Button variant="ghost" onClick={() => setStep((current) => current - 1)}>上一步</Button> : null}
          {step === 1 ? <Button disabled={!projectId} onClick={() => setStep(2)}>下一步</Button> : null}
          {step === 2 ? <Button disabled={!creatorId} onClick={() => setStep(3)}>下一步</Button> : null}
          {step === 4 ? <Button disabled={!documents.length} onClick={() => setStep(5)}>保存前确认</Button> : null}
          {step === 5 ? <Button onClick={save}>保存待确认合同</Button> : null}
        </>
      )}
    >
      <ol className="contract-upload-steps" aria-label="合同上传步骤">
        {['选择项目', '选择达人', '上传文件', '查看识别', '保存合同'].map((label, index) => (
          <li className={step === index + 1 ? 'active' : step > index + 1 ? 'complete' : ''} key={label}>
            <span>{step > index + 1 ? <Check size={14} /> : index + 1}</span><em>{label}</em>
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="contract-upload-pane">
          <label className="search-control">
            <Search size={16} />
            <input aria-label="搜索项目" placeholder="搜索项目名称、编号或客户" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <div className="contract-upload-options">
            {visibleProjects.map((project) => (
              <button className={projectId === project.id ? 'selected' : ''} type="button" key={project.id} onClick={() => { setProjectId(project.id); setCreatorId(''); }}>
                <FileText size={18} /><span><strong>{project.name}</strong><small>{project.id} · {project.brand} · {project.creators} 位达人</small></span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="contract-upload-pane">
          <p className="contract-upload-context">{selectedProject?.name} · 仅显示该项目已关联的达人</p>
          <div className="contract-upload-options">
            {projectCreators.map((creator) => (
              <button className={creatorId === creator.id ? 'selected' : ''} type="button" key={creator.id} onClick={() => setCreatorId(creator.id)}>
                <UserRound size={18} /><span><strong>{creator.name}</strong><small>{creator.handle} · {creator.platform}</small></span>
              </button>
            ))}
            {projectCreators.length === 0 ? <p className="contract-upload-empty">该项目没有可验证的达人关联，请先维护项目合作达人。</p> : null}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="contract-upload-pane">
          <label className="contract-file-drop">
            <Upload size={24} />
            <strong>{parsing ? '正在浏览器本地解析…' : '选择 PDF 或 DOCX 合同文件'}</strong>
            <small>可同时选择 Standard Terms、IO、签署页等，最多 10 份，单份不超过 30 MB。</small>
            <input
              type="file"
              multiple
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={parsing}
              onChange={(event) => selectFiles(event.target.files)}
            />
          </label>
          <p className="contract-upload-context">文件只在当前浏览器本地解析，不会上传；扫描件暂不支持自动识别。</p>
          {error ? <p className="contract-upload-error" role="alert">{error}</p> : null}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="contract-upload-pane contract-recognition-review">
          <div className="contract-source-file-list">
            {documents.map((document) => (
              <article className={`contract-source-file contract-source-file-${document.parseStatus}`} key={document.id}>
                <FileText size={18} />
                <div>
                  <strong>{document.fileName}</strong>
                  <small>{STATUS_LABELS[document.parseStatus]}{document.pageCount ? ` · ${document.pageCount} 页` : ''}</small>
                  {document.errorMessage ? <p>{document.errorMessage}</p> : null}
                </div>
                <select
                  aria-label={`${document.fileName} 文档类型`}
                  value={document.documentType}
                  onChange={(event) => changeDocumentType(document.id, event.target.value as ContractDocumentType)}
                >
                  {Object.entries(CONTRACT_DOCUMENT_TYPE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </article>
            ))}
          </div>
          <div className="contract-recognition-field-list">
            {fields.map((field) => (
              <article className={`contract-recognition-field contract-recognition-field-${field.status}`} key={field.fieldKey}>
                <div>
                  <strong>{field.label}</strong>
                  <span className="contract-recognition-status">{FIELD_STATUS_LABELS[field.status]}</span>
                </div>
                <p>{field.rawValue || '待补充'}</p>
                <small>
                  {field.source
                    ? `${CONTRACT_DOCUMENT_TYPE_LABELS[field.source.documentType]}${field.source.pageNumber ? ` · 第 ${field.source.pageNumber} 页` : ` · ${field.source.section}`}`
                    : '未找到可靠来源'}
                </small>
                {field.status === 'conflict' ? <em><AlertTriangle size={13} />发现 {field.candidates.length} 个候选值，保存后需人工核对</em> : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="contract-upload-summary">
          <Check size={28} />
          <h3>将保存为待确认合同</h3>
          <p>{systemContractNumber} · {selectedProject?.name} · {selectedCreator?.name}</p>
          <small>识别值不会自动覆盖正式合同资料。请在合同详情逐项编辑并确认，全部确认后再统一应用。</small>
        </div>
      ) : null}
    </Modal>
  );
}
