import { AlertTriangle, Check, FileText, LoaderCircle, Upload, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  createSelectedContractFiles,
  parseContractFiles,
  type SelectedContractFile,
  validateContractFile,
} from '../contractParserClient';
import {
  recognitionFieldDisplayValue,
  recognizeUploadContractFields,
} from '../contractRecognition';
import {
  CONTRACT_DOCUMENT_TYPE_LABELS,
  type ContractRecognitionField,
  type ContractUploadDocumentType,
  type ParsedContractDocument,
} from '../contractRecognitionTypes';
import {
  CONTRACT_TYPE_LABELS,
  contractLinkedToProject,
  getContractType,
  isFrameworkContract,
  type ContractRecord,
  type ContractType,
  type ContractUploadInput,
} from '../contracts';
import {
  createPrototypeCode,
  type ContractId,
  type CreatorId,
  type EngagementId,
  type ProjectId,
} from '../businessWorkflow';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import { cooperationProjectIdFor } from '../paymentRequestProjects';
import type { CreatorProfile } from '../types';
import { Button, Modal, SelectField } from './Common';
import {
  creatorSearchOptions,
  resolveCreatorSocialAccount,
} from '../creatorSearchOptions';
import { SearchableComboBox } from './SearchableComboBox';
import { CreatorIdentity } from './CreatorIdentity';

type Props = {
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  contracts: ContractRecord[];
  onClose: () => void;
  onSave: (inputs: ContractUploadInput[]) => void;
  initialProjectId?: string;
  initialCreatorId?: string;
  initialDraftContractId?: string;
  initialContractType?: ContractType;
  allowedContractTypes?: ContractType[];
  title?: string;
  submitLabel?: string;
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

export const contractNameFromUploadFile = (fileName: string) => {
  const normalized = fileName.trim();
  const withoutExtension = normalized.replace(/\.(pdf|docx)$/i, '').trim();
  return withoutExtension || normalized;
};

export const contractUploadCreatorSearchOptions = (creators: CreatorProfile[]) => (
  creatorSearchOptions(creators).map((option) => ({
    ...option,
    selectedLabel: option.label,
  }))
);

export function ContractUploadWizard({
  projects,
  creators,
  contracts,
  onClose,
  onSave,
  initialProjectId = '',
  initialCreatorId = '',
  initialDraftContractId = '',
  initialContractType = 'INDEPENDENT',
  allowedContractTypes = Object.keys(CONTRACT_TYPE_LABELS) as ContractType[],
  title = '上传合同',
  submitLabel = '保存待确认合同',
}: Props) {
  const initialCreator = creators.find((creator) => creator.id === initialCreatorId) ?? null;
  const initialSocialAccount = resolveCreatorSocialAccount(initialCreator);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [creatorId, setCreatorId] = useState(initialCreatorId);
  const [creatorSocialAccountId, setCreatorSocialAccountId] = useState(initialSocialAccount?.id ?? '');
  const [contractName, setContractName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedContractFile[]>([]);
  const [documents, setDocuments] = useState<ParsedContractDocument[]>([]);
  const [frameworkSelections, setFrameworkSelections] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<ContractRecognitionField[]>([]);
  const [systemContractNumber] = useState(() => createPrototypeCode('CON'));
  const [draftContractId, setDraftContractId] = useState(initialDraftContractId);
  const [error, setError] = useState('');
  const [parsing, setParsing] = useState(false);
  const selectedProject = projects.find((project) => cooperationProjectIdFor(project) === projectId) ?? null;
  const selectedCreator = creators.find((creator) => creator.id === creatorId) ?? null;
  const selectedSocialAccount = resolveCreatorSocialAccount(selectedCreator, creatorSocialAccountId);
  const creatorSelectionValue = creatorId;
  const selectedProjectInternalId = selectedProject
    ? cooperationProjectIdFor(selectedProject) as ProjectId
    : null;
  const draftCandidates = contracts.filter((contract) => (
    contract.lifecycle === 'GENERATED_DRAFT'
    && Boolean(contract.contractId)
    && Boolean(selectedProjectInternalId && contractLinkedToProject(contract, selectedProjectInternalId))
    && contract.creatorId === creatorId
  ));
  const projectOptions = projects.map((project) => ({
    value: cooperationProjectIdFor(project),
    label: project.name,
    description: `${project.cooperationProjectCode ?? project.projectCode ?? project.id} · ${project.brand} · ${project.creators} 位达人`,
    searchText: `${project.name} ${project.brand} ${project.cooperationProjectCode ?? ''} ${project.projectCode ?? ''}`,
  }));
  const creatorOptions = contractUploadCreatorSearchOptions(creators);
  const frameworkOptions = contracts
    .filter((contract) => isFrameworkContract(contract) && contract.creatorId === creatorId)
    .map((contract) => ({
      value: `contract:${contract.contractId ?? contract.id}`,
      label: `${contract.id} · ${contract.name}`,
      description: `${contract.project} · ${getContractType(contract)}`,
    }));
  const batchFrameworkOptions = selectedFiles
    .filter((file) => file.contractType === 'FRAMEWORK')
    .map((file) => ({
      value: `upload:${file.id}`,
      label: `本次上传：${file.file.name}`,
      description: '保存后作为本批次可复用的框架合同',
    }));
  const conflictCount = fields.filter((field) => field.status === 'conflict').length;
  const visibleFields = fields.filter((field) => field.applicable !== false);
  const missingCount = visibleFields.filter((field) => (
    field.status === 'missing'
    && field.requiredForConfirmation !== false
    && !field.readOnly
  )).length;
  const hasRecognizedAccountFields = visibleFields.some((field) => field.group === 'bank' || field.group === 'paypal');
  const engagementReference = selectedProject?.creatorProfiles?.find((creator) => creator.creatorId === selectedCreator?.id && creator.status !== 'removed');
  const canSave = Boolean(selectedProject && selectedCreator && contractName.trim() && documents.length === 1 && !parsing);

  useEffect(() => {
    if (!documents.length) {
      setFields([]);
      return;
    }
    setFields(recognizeUploadContractFields(documents, { systemContractNumber }));
  }, [
    documents,
    systemContractNumber,
  ]);

  const parseSelection = async (files: SelectedContractFile[]) => {
    setError('');
    setParsing(true);
    try {
      const parsed = await parseContractFiles(files);
      const normalizedFiles = files.map((file) => (
        allowedContractTypes.includes(file.contractType)
          ? file
          : { ...file, contractType: initialContractType }
      ));
      setSelectedFiles(normalizedFiles);
      setFrameworkSelections({});
      setDocuments(parsed.map((document) => ({
        ...document,
        contractType: normalizedFiles.find((file) => file.id === document.id)?.contractType ?? initialContractType,
      })));
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
    if (files.length > 1) {
      setError('一次只能上传 1 份合同文件。');
      return;
    }
    const invalid = files.map((file) => ({ file, message: validateContractFile(file) })).find((item) => item.message);
    if (invalid) {
      setError(`${invalid.file.name}：${invalid.message}`);
      return;
    }
    setContractName(contractNameFromUploadFile(files[0].name));
    void parseSelection(createSelectedContractFiles(files));
  };

  const changeContractType = (documentId: string, contractType: ContractType) => {
    if (!allowedContractTypes.includes(contractType)) return;
    const documentType: ContractUploadDocumentType = contractType === 'IO' ? 'IO' : 'STANDARD_TERMS';
    const nextSelected = selectedFiles.map((item) => item.id === documentId
      ? { ...item, contractType, documentType }
      : item);
    const nextDocuments = documents.map((document) => (
      document.id === documentId ? { ...document, documentType, contractType } : document
    ));
    setSelectedFiles(nextSelected);
    setDocuments(nextDocuments);
    if (contractType !== 'IO') {
      setFrameworkSelections((current) => {
        const next = { ...current };
        delete next[documentId];
        return next;
      });
    }
  };

  const save = () => {
    if (!selectedProject || !selectedCreator || !contractName.trim() || selectedFiles.length !== 1 || documents.length !== 1) return;
    const reference = selectedProject.creatorProfiles?.find((creator) => creator.creatorId === selectedCreator.id && creator.status !== 'removed');
    const selectedDraft = draftCandidates.find((contract) => contract.contractId === draftContractId);
    const inputs = documents.map((document, index) => {
      const selected = selectedFiles.find((item) => item.id === document.id);
      const contractType = selected?.contractType ?? 'INDEPENDENT';
      const frameworkSelection = frameworkSelections[document.id] ?? '';
      const frameworkContractId = frameworkSelection.startsWith('contract:')
        ? frameworkSelection.slice('contract:'.length) as ContractId
        : undefined;
      const frameworkUploadKey = frameworkSelection.startsWith('upload:')
        ? frameworkSelection.slice('upload:'.length)
        : undefined;
      const recognitionResults = recognizeUploadContractFields(
        [{ ...document, contractType }],
        { systemContractNumber: selectedDraft?.id ?? (index === 0 ? systemContractNumber : createPrototypeCode('CON')) },
      );
      return {
        systemContractNumber: selectedDraft?.id ?? (index === 0 ? systemContractNumber : createPrototypeCode('CON')),
        contractName: contractName.trim() || selectedDraft?.name,
        contractType,
        frameworkContractId,
        frameworkUploadKey,
        projectId: cooperationProjectIdFor(selectedProject) as ProjectId,
        cooperationProjectId: (
          selectedProject.cooperationProjectId
          ?? selectedProject.projectId
          ?? selectedProject.id
        ) as ProjectId,
        projectLinks: [{
          cooperationProjectId: cooperationProjectIdFor(selectedProject) as ProjectId,
          status: 'ACTIVE' as const,
        }],
        projectName: selectedProject.name,
        customer: selectedProject.brand,
        creatorId: selectedCreator.id as CreatorId,
        creatorName: selectedCreator.name,
        creatorHandle: selectedSocialAccount?.handle ?? selectedCreator.handle,
        creatorSocialAccountId: selectedSocialAccount?.id,
        creatorPlatform: selectedSocialAccount?.platform ?? selectedCreator.platform,
        engagementId: reference?.engagementId as EngagementId | undefined,
        draftContractId: selectedDraft?.contractId as ContractId | undefined,
        recognitionResults,
        sourceDocuments: [{
          ...document,
          contractType,
          documentUrl: selected ? URL.createObjectURL(selected.file) : '',
        }],
      } satisfies ContractUploadInput;
    });
    onSave(inputs);
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      width="1080px"
      className="contract-upload-modal"
      footer={(
        <>
          <div className="contract-upload-footer-status" aria-live="polite">
            <span>{documents.length ? '1 份文件已解析' : '尚未选择合同文件'}</span>
            <small>{documents.length ? `${visibleFields.length} 个字段 · ${conflictCount} 项需核对 · ${missingCount} 项待补充` : '完成关联信息并上传文件后，可确认合同名称并保存'}</small>
          </div>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button
            type="submit"
            form="contract-upload-form"
            disabled={!canSave}
            disabledReason={parsing
              ? '合同文件正在解析，请稍候。'
              : !selectedCreator
                  ? '请先选择合作达人。'
                : !selectedProject
                  ? '请选择合作项目。'
                  : !documents.length
                    ? '请先上传一份合同文件。'
                    : !contractName.trim()
                      ? '请填写合同名称。'
                      : '请完成合同资料后再保存。'}
          >{submitLabel}</Button>
        </>
      )}
    >
      <form
        id="contract-upload-form"
        className="contract-upload-form"
        aria-busy={parsing}
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <section className="contract-upload-form-section" aria-labelledby="contract-upload-association-title">
          <header className="contract-upload-section-head">
            <span><UserRound size={18} /></span>
            <div>
              <h3 id="contract-upload-association-title">关联信息</h3>
              <p>先选择合作达人，再选择合同所属项目；保存后建立内部关联关系。</p>
            </div>
            <em>必填</em>
          </header>
          <div className="contract-upload-field-grid">
            <div className="contract-upload-field">
              <span>合作达人 *</span>
              <SearchableComboBox
                ariaLabel="合作达人"
                className="creator-search-combobox"
                value={creatorSelectionValue}
                placeholder="搜索 Display Name、频道 ID、频道链接…"
                options={creatorOptions}
                resultUnit="位达人"
                renderOption={(option) => <CreatorIdentity creator={creators.find((creator) => creator.id === option.value)} socialAccountsMode="expanded" />}
                onChange={(value) => {
                  const creator = creators.find((item) => item.id === value);
                  setCreatorId(creator?.id ?? '');
                  setCreatorSocialAccountId(resolveCreatorSocialAccount(creator)?.id ?? '');
                  setProjectId('');
                  setDraftContractId('');
                }}
                onClear={() => {
                  setCreatorId('');
                  setCreatorSocialAccountId('');
                  setProjectId('');
                  setDraftContractId('');
                }}
              />
              <small>支持搜索 Display Name、频道 ID、频道链接、法定真名、Account Name；范围为全部达人档案</small>
            </div>
            <div className="contract-upload-field">
              <span>合作项目 *</span>
              <SearchableComboBox
                ariaLabel="合作项目"
                value={projectId}
                placeholder={selectedCreator ? '搜索项目名称、编号或品牌' : '请先选择达人'}
                options={projectOptions}
                disabled={!selectedCreator}
                onChange={(value) => {
                  setProjectId(value);
                  setDraftContractId('');
                }}
                onClear={() => {
                  setProjectId('');
                  setDraftContractId('');
                }}
              />
              <small>{selectedCreator ? '可选择当前账号可管理的项目；保存后自动建立项目达人关系' : '选择达人后加载合作项目'}</small>
            </div>
            <div className="contract-upload-field">
              <span>历史生成合同</span>
              <SelectField
                ariaLabel="历史生成合同"
                variant="form"
                value={draftContractId}
                placeholder={creatorId ? '可选：选择历史生成合同' : '请先选择达人'}
                options={[
                  { value: '', label: '不覆盖历史生成合同', description: '作为新的上传合同保存' },
                  ...draftCandidates.map((contract) => ({
                    value: contract.contractId!,
                    label: contract.id,
                    description: `${CONTRACT_TYPE_LABELS[getContractType(contract)]} · 版本 v${contract.generationVersion ?? 1} · ${contract.updated}`,
                  })),
                ]}
                disabled={!creatorId}
                onChange={setDraftContractId}
              />
              <small>选择后沿用历史生成合同 ID</small>
            </div>
          </div>
          {selectedProject && selectedCreator && !engagementReference ? (
            <p className="contract-upload-empty">该达人尚未关联当前项目，保存时会自动建立项目合作关系。</p>
          ) : null}
          {selectedProject && selectedCreator ? (
            <div className="contract-upload-association-summary">
              <FileText size={16} />
              <div>
                <strong>{selectedProject.name}</strong>
                <span>{selectedProject.id} · {selectedProject.brand}</span>
              </div>
              <div>
                <CreatorIdentity creator={selectedCreator} />
              </div>
            </div>
          ) : null}
        </section>

        <section className="contract-upload-form-section" aria-labelledby="contract-upload-files-title">
          <header className="contract-upload-section-head">
            <span><Upload size={18} /></span>
            <div>
              <h3 id="contract-upload-files-title">合同文件</h3>
              <p>支持文字型 PDF 与标准 DOCX，上传后可选择独立合同、框架合同或 IO 单。</p>
            </div>
            {documents.length ? <em>{documents.length} 份</em> : null}
          </header>
          <div className="contract-upload-file-grid">
            <label className={`contract-file-drop${!selectedCreator ? ' disabled' : ''}`}>
              {parsing ? <LoaderCircle className="contract-upload-spinner" size={24} /> : <Upload size={24} />}
              <strong>{parsing ? '正在浏览器本地解析…' : selectedCreator ? '点击选择合同文件' : '请先选择合作达人'}</strong>
              <small>仅支持 1 份，单份不超过 30 MB</small>
              <span>{selectedFiles.length ? '重新选择文件' : '选择 PDF / DOCX'}</span>
              <input
                className="contract-file-input"
                type="file"
                aria-label="选择合同文件"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={!selectedCreator || parsing}
                onChange={(event) => selectFiles(event.target.files)}
              />
            </label>
            <div className="contract-upload-file-notes">
              <strong>本地解析说明</strong>
              <p><Check size={14} />文件仅在当前浏览器处理，不上传外部服务</p>
              <p><Check size={14} />按文件保留页码、章节与原文来源</p>
              <p><AlertTriangle size={14} />扫描件、加密或损坏文件需要人工处理</p>
            </div>
          </div>
          {error ? <p className="contract-upload-error" role="alert">{error}</p> : null}
          {documents.length ? (
            <>
              <div className="contract-source-file-list" aria-label="已解析合同文件">
                {documents.map((document) => (
                  <article className={`contract-source-file contract-source-file-${document.parseStatus}`} key={document.id}>
                    <FileText size={18} />
                    <div>
                      <strong>{document.fileName}</strong>
                      <small>{STATUS_LABELS[document.parseStatus]}{document.pageCount ? ` · ${document.pageCount} 页` : ''}</small>
                      {document.errorMessage ? <p>{document.errorMessage}</p> : null}
                    </div>
                    <div className="contract-source-file-controls">
                      <select
                        aria-label={`${document.fileName} 合同类型`}
                        value={document.contractType ?? 'INDEPENDENT'}
                        onChange={(event) => changeContractType(document.id, event.target.value as ContractType)}
                      >
                        {allowedContractTypes.map((type) => (
                          <option value={type} key={type}>{CONTRACT_TYPE_LABELS[type]}</option>
                        ))}
                      </select>
                      {(document.contractType ?? 'INDEPENDENT') === 'IO' ? (
                        <select
                          aria-label={`${document.fileName} 框架合同`}
                          value={frameworkSelections[document.id] ?? ''}
                          onChange={(event) => setFrameworkSelections((current) => ({ ...current, [document.id]: event.target.value }))}
                        >
                          <option value="">不绑定框架合同</option>
                          {[...frameworkOptions, ...batchFrameworkOptions].map((option) => (
                            <option value={option.value} key={option.value}>{option.label}</option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
              <label className={`contract-upload-field contract-upload-contract-name${!contractName.trim() ? ' contract-upload-field-required' : ''}`}>
                <span>合同名称 *</span>
                <input
                  aria-label="合同名称"
                  value={contractName}
                  placeholder="默认使用上传文件名"
                  maxLength={120}
                  onChange={(event) => setContractName(event.target.value)}
                />
                <small>默认使用上传文件名，可修改；用于合同列表、详情和签署文件回传匹配</small>
              </label>
            </>
          ) : null}
        </section>

        <section className="contract-upload-form-section" aria-labelledby="contract-upload-recognition-title">
          <header className="contract-upload-section-head">
            <span><FileText size={18} /></span>
            <div>
              <h3 id="contract-upload-recognition-title">识别结果</h3>
              <p>从合同原文识别主体、金额、签署、有效期、账户及平台频道，系统合同编号自动带入。</p>
            </div>
            {visibleFields.length ? <em>{visibleFields.length} 项</em> : null}
          </header>
          {visibleFields.length ? (
            <div className="contract-recognition-field-list">
              {visibleFields.map((field) => (
                <article className={`contract-recognition-field contract-recognition-field-${field.status}`} key={field.fieldKey}>
                  <div>
                    <strong>{field.label}</strong>
                    <span className="contract-recognition-status">{field.readOnly ? '系统生成' : FIELD_STATUS_LABELS[field.status]}</span>
                  </div>
                  <p>{recognitionFieldDisplayValue(field) || '待补充'}</p>
                  <small>
                    {field.source
                      ? `${field.source.documentId === 'system-contract' ? '系统字段' : CONTRACT_DOCUMENT_TYPE_LABELS[field.source.documentType]}${field.source.pageNumber ? ` · 第 ${field.source.pageNumber} 页` : ` · ${field.source.section}`}`
                      : '未找到可靠来源'}
                  </small>
                  {field.status === 'conflict' ? <em><AlertTriangle size={13} />发现 {field.candidates.length} 个候选值，保存后需人工核对</em> : null}
                </article>
              ))}
              {!hasRecognizedAccountFields ? (
                <article className="contract-recognition-field contract-recognition-field-missing contract-recognition-account-empty">
                  <div>
                    <strong>收款账户信息</strong>
                    <span className="contract-recognition-status">未识别</span>
                  </div>
                  <p>未识别到银行或 PayPal 账户信息</p>
                  <small>不会生成或覆盖达人档案中的付款账户</small>
                </article>
              ) : null}
            </div>
          ) : (
            <div className="contract-recognition-empty">
              <FileText size={22} />
              <div>
                <strong>{parsing ? '正在识别合同字段' : '等待合同文件'}</strong>
                <span>{parsing ? '文件解析完成后会展示字段值与原文来源' : '上传文件后，识别结果会在当前表单中展开'}</span>
              </div>
            </div>
          )}
        </section>

        <section className="contract-upload-form-section contract-upload-save-section" aria-labelledby="contract-upload-save-title">
          <header className="contract-upload-section-head">
            <span><Check size={18} /></span>
            <div>
              <h3 id="contract-upload-save-title">保存信息</h3>
              <p>合同将以待确认状态保存，不会自动覆盖正式合同或达人收款资料。</p>
            </div>
          </header>
          <div className="contract-upload-save-grid">
            <div><span>系统合同编号</span><strong>{systemContractNumber}</strong></div>
            <div><span>保存状态</span><strong>待人工确认</strong></div>
            <p><AlertTriangle size={15} />主体、金额、签署状态、有效期及识别到的账户字段仍需在合同详情中核对后才能应用。</p>
          </div>
        </section>
      </form>
    </Modal>
  );
}
