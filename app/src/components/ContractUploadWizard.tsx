import { AlertTriangle, Check, FileText, LoaderCircle, Upload, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  createSelectedContractFiles,
  parseContractFiles,
  type SelectedContractFile,
  validateContractFile,
} from '../contractParserClient';
import { createPrototypeRecognitionFields } from '../contractRecognitionPrototype';
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

type Props = {
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  contracts: ContractRecord[];
  onClose: () => void;
  onSave: (inputs: ContractUploadInput[]) => void;
  initialProjectId?: string;
  initialCreatorId?: string;
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

export function ContractUploadWizard({
  projects,
  creators,
  contracts,
  onClose,
  onSave,
  initialProjectId = '',
  initialCreatorId = '',
  initialContractType = 'INDEPENDENT',
  allowedContractTypes = Object.keys(CONTRACT_TYPE_LABELS) as ContractType[],
  title = '上传合同',
  submitLabel = '保存待确认合同',
}: Props) {
  const [projectId, setProjectId] = useState(initialProjectId);
  const [projectLinkIds, setProjectLinkIds] = useState<string[]>(initialProjectId ? [initialProjectId] : []);
  const [creatorId, setCreatorId] = useState(initialCreatorId);
  const [contractName, setContractName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedContractFile[]>([]);
  const [documents, setDocuments] = useState<ParsedContractDocument[]>([]);
  const [frameworkSelections, setFrameworkSelections] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<ContractRecognitionField[]>([]);
  const [systemContractNumber] = useState(() => createPrototypeCode('CON'));
  const [draftContractId, setDraftContractId] = useState('');
  const [error, setError] = useState('');
  const [parsing, setParsing] = useState(false);
  const selectedProject = projects.find((project) => cooperationProjectIdFor(project) === projectId) ?? null;
  const selectedCreator = creators.find((creator) => creator.id === creatorId) ?? null;
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
  }));
  const creatorOptions = creators.map((creator) => ({
    value: creator.id,
    label: creator.name,
    description: `${creator.handle} · ${creator.region} · ${creator.platform}`,
  }));
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
  const missingCount = fields.filter((field) => field.status === 'missing').length;
  const engagementReference = selectedProject?.creatorProfiles?.find((creator) => creator.creatorId === selectedCreator?.id && creator.status !== 'removed');
  const creatorProjectOptions = projects.filter((project) => project.creatorProfiles?.some((reference) => (
    reference.creatorId === creatorId && reference.status !== 'removed'
  )));
  const canSave = Boolean(selectedProject && selectedCreator && contractName.trim() && documents.length === 1 && !parsing);

  useEffect(() => {
    if (!documents.length) {
      setFields([]);
      return;
    }
    setFields(createPrototypeRecognitionFields({
      documents,
      systemContractNumber,
      projectName: selectedProject?.name ?? 'Creator Campaign 2026',
      brandName: selectedProject?.brand ?? 'COMETS Demo Brand',
      creatorName: selectedCreator?.name ?? 'Demo Creator',
      creatorHandle: selectedCreator?.handle ?? '@demo.creator',
      creatorPlatform: selectedCreator?.platform ?? 'YouTube',
    }));
  }, [
    documents,
    selectedCreator?.handle,
    selectedCreator?.name,
    selectedCreator?.platform,
    selectedProject?.brand,
    selectedProject?.name,
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
    if (contractType !== 'INDEPENDENT') setDraftContractId('');
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
    const selectedDraft = selectedFiles.length === 1 && selectedFiles[0].contractType === 'INDEPENDENT'
      ? draftCandidates.find((contract) => contract.contractId === draftContractId)
      : undefined;
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
      const recognitionResults = createPrototypeRecognitionFields({
        documents: [{ ...document, contractType }],
        systemContractNumber: selectedDraft?.id ?? (index === 0 ? systemContractNumber : createPrototypeCode('CON')),
        projectName: selectedProject.name,
        brandName: selectedProject.brand,
        creatorName: selectedCreator.name,
        creatorHandle: selectedCreator.handle,
        creatorPlatform: selectedCreator.platform,
      });
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
        projectLinks: [...new Set([...projectLinkIds, cooperationProjectIdFor(selectedProject)])].map((cooperationProjectId) => ({
          cooperationProjectId: cooperationProjectId as ProjectId,
          status: 'ACTIVE' as const,
        })),
        projectName: selectedProject.name,
        customer: selectedProject.brand,
        creatorId: selectedCreator.id as CreatorId,
        creatorName: selectedCreator.name,
        creatorHandle: selectedCreator.handle,
        creatorPlatform: selectedCreator.platform,
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
            <small>{documents.length ? `${fields.length} 个字段 · ${conflictCount} 项需核对 · ${missingCount} 项待补充` : '完成合同名称、关联信息并上传文件后可保存'}</small>
          </div>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button type="submit" form="contract-upload-form" disabled={!canSave}>{submitLabel}</Button>
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
              <p>选择合同所属项目与合作达人，系统将按内部关联关系保存。</p>
            </div>
            <em>必填</em>
          </header>
          <div className="contract-upload-field-grid">
            <div className="contract-upload-field">
              <span>合作项目 *</span>
              <SelectField
                ariaLabel="合作项目"
                variant="form"
                value={projectId}
                placeholder="选择飞书合作项目"
                options={projectOptions}
                onChange={(value) => {
                  setProjectId(value);
                  setProjectLinkIds(value ? [value] : []);
                  setCreatorId('');
                  setDraftContractId('');
                  setContractName('');
                }}
              />
              <small>用于合同、IO 与后续 Invoice 的系统关联</small>
            </div>
            <div className="contract-upload-field">
              <span>合作达人 *</span>
              <SelectField
                ariaLabel="合作达人"
                variant="form"
                value={creatorId}
                placeholder={selectedProject ? '选择全系统达人' : '请先选择项目'}
                options={creatorOptions}
                disabled={!selectedProject}
                onChange={(value) => {
                  setCreatorId(value);
                  const eligibleIds = new Set(projects.filter((project) => project.creatorProfiles?.some((reference) => (
                    reference.creatorId === value && reference.status !== 'removed'
                  ))).map((project) => String(cooperationProjectIdFor(project))));
                  setProjectLinkIds((current) => [...new Set([
                    ...current.filter((id) => eligibleIds.has(id)),
                    ...(projectId ? [projectId] : []),
                  ])]);
                  setDraftContractId('');
                  setContractName('');
                }}
              />
              <small>{selectedProject ? '显示全系统达人；未关联当前项目时保存会自动补建合作关系' : '选择项目后加载全系统达人'}</small>
            </div>
            <label className={`contract-upload-field contract-upload-field-wide${!contractName.trim() ? ' contract-upload-field-required' : ''}`}>
              <span>合同名称 *</span>
              <input
                aria-label="合同名称"
                value={contractName}
                placeholder="建议格式：达人名称-付款项目名"
                maxLength={120}
                onChange={(event) => setContractName(event.target.value)}
              />
              <small>用于合同列表、详情和签署文件回传匹配</small>
            </label>
            {allowedContractTypes.includes('INDEPENDENT') ? <div className="contract-upload-field">
              <span>对应生成草稿</span>
              <SelectField
                ariaLabel="对应生成草稿"
                variant="form"
                value={draftContractId}
                placeholder={creatorId ? '可选：选择待回传草稿' : '请先选择达人'}
                options={[
                  { value: '', label: '不关联生成草稿', description: '作为新的上传合同保存' },
                  ...draftCandidates.map((contract) => ({
                    value: contract.contractId!,
                    label: contract.id,
                    description: `版本 v${contract.generationVersion ?? 1} · ${contract.updated}`,
                  })),
                ]}
                disabled={!creatorId}
                onChange={(value) => {
                  setDraftContractId(value);
                  setContractName(value ? draftCandidates.find((contract) => contract.contractId === value)?.name ?? '' : '');
                }}
              />
              <small>选择后沿用草稿合同 ID，并保留原生成快照</small>
            </div> : null}
            {selectedProject && selectedCreator ? (
              <div className="contract-upload-field contract-upload-field-wide contract-project-links">
                <span>覆盖合作项目 <small>可多选</small></span>
                <div className="invoice-contract-options" role="group" aria-label="上传合同覆盖合作项目">
                  {creatorProjectOptions.map((project) => {
                    const id = String(cooperationProjectIdFor(project));
                    const primary = id === projectId;
                    const checked = primary || projectLinkIds.includes(id);
                    return (
                      <label key={id}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={primary}
                          onChange={() => setProjectLinkIds((current) => current.includes(id)
                            ? current.filter((projectId) => projectId !== id)
                            : [...current, id])}
                        />
                        <span><strong>{project.name}</strong><small>{primary ? '主合作项目' : project.cooperationProjectCode ?? project.projectCode ?? project.id}</small></span>
                      </label>
                    );
                  })}
                </div>
                <small>只展示该达人已参与的合作项目；IO 单无需绑定框架合同。</small>
              </div>
            ) : null}
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
                <strong>{selectedCreator.name}</strong>
                <span>{selectedCreator.handle} · {selectedCreator.platform}</span>
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
              <strong>{parsing ? '正在浏览器本地解析…' : selectedCreator ? '点击选择合同文件' : '请先完成项目与达人关联'}</strong>
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
          ) : null}
        </section>

        <section className="contract-upload-form-section" aria-labelledby="contract-upload-recognition-title">
          <header className="contract-upload-section-head">
            <span><FileText size={18} /></span>
            <div>
              <h3 id="contract-upload-recognition-title">识别结果</h3>
              <p>上传后展示完整的原型演示字段，保存后同步到合同详情逐项确认。</p>
            </div>
            {fields.length ? <em>{fields.length} 项</em> : null}
          </header>
          {fields.length ? (
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
                      ? `${field.source.documentId === 'system-contract' ? '系统字段' : CONTRACT_DOCUMENT_TYPE_LABELS[field.source.documentType]}${field.source.pageNumber ? ` · 第 ${field.source.pageNumber} 页` : ` · ${field.source.section}`}`
                      : '未找到可靠来源'}
                  </small>
                  {field.status === 'conflict' ? <em><AlertTriangle size={13} />发现 {field.candidates.length} 个候选值，保存后需人工核对</em> : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="contract-recognition-empty">
              <FileText size={22} />
              <div>
                <strong>{parsing ? '正在准备演示识别结果' : '等待合同文件'}</strong>
                <span>{parsing ? '文件解析完成后会展示完整字段与来源' : '上传文件后无需切换页面，演示结果会在当前表单中展开'}</span>
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
            <p><AlertTriangle size={15} />金额、主体、日期与收款账户仍需在合同详情中逐项核对后才能应用。</p>
          </div>
        </section>
      </form>
    </Modal>
  );
}
