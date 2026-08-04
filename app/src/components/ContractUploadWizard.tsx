import { AlertTriangle, Check, FileText, LoaderCircle, Upload, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  createSelectedContractFiles,
  MAX_CONTRACT_FILE_COUNT,
  parseContractFiles,
  type SelectedContractFile,
  validateContractFile,
} from '../contractParserClient';
import { createPrototypeRecognitionFields } from '../contractRecognitionPrototype';
import {
  CONTRACT_DOCUMENT_TYPE_LABELS,
  CONTRACT_UPLOAD_DOCUMENT_TYPE_OPTIONS,
  type ContractRecognitionField,
  type ContractUploadDocumentType,
  type ParsedContractDocument,
} from '../contractRecognitionTypes';
import type { ContractRecord, ContractUploadInput } from '../contracts';
import {
  createPrototypeCode,
  type ContractId,
  type CreatorId,
  type EngagementId,
  type ProjectId,
} from '../businessWorkflow';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import type { CreatorProfile } from '../types';
import { Button, Modal, SelectField } from './Common';

type Props = {
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  contracts: ContractRecord[];
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

export function ContractUploadWizard({ projects, creators, contracts, onClose, onSave }: Props) {
  const [projectId, setProjectId] = useState('');
  const [creatorId, setCreatorId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedContractFile[]>([]);
  const [documents, setDocuments] = useState<ParsedContractDocument[]>([]);
  const [fields, setFields] = useState<ContractRecognitionField[]>([]);
  const [systemContractNumber] = useState(() => createPrototypeCode('CON'));
  const [draftContractId, setDraftContractId] = useState('');
  const [error, setError] = useState('');
  const [parsing, setParsing] = useState(false);
  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const projectCreators = useMemo(() => {
    if (!selectedProject) return [];
    const references = selectedProject.creatorProfiles ?? [];
    return references
      .map((reference) => creators.find((creator) => creator.id === reference.creatorId))
      .filter((creator): creator is CreatorProfile => Boolean(creator));
  }, [creators, selectedProject]);
  const selectedCreator = projectCreators.find((creator) => creator.id === creatorId) ?? null;
  const selectedProjectInternalId = selectedProject
    ? (selectedProject.projectId ?? selectedProject.id) as ProjectId
    : null;
  const draftCandidates = contracts.filter((contract) => (
    contract.lifecycle === 'GENERATED_DRAFT'
    && Boolean(contract.contractId)
    && contract.projectId === selectedProjectInternalId
    && contract.creatorId === creatorId
  ));
  const projectOptions = projects.map((project) => ({
    value: project.id,
    label: project.name,
    description: `${project.id} · ${project.brand} · ${project.creators} 位达人`,
  }));
  const creatorOptions = projectCreators.map((creator) => ({
    value: creator.id,
    label: creator.name,
    description: `${creator.handle} · ${creator.platform}`,
  }));
  const conflictCount = fields.filter((field) => field.status === 'conflict').length;
  const missingCount = fields.filter((field) => field.status === 'missing').length;
  const engagementReference = selectedProject?.creatorProfiles?.find((creator) => creator.creatorId === selectedCreator?.id);
  const canSave = Boolean(selectedProject && selectedCreator && engagementReference && documents.length && !parsing);

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
      setSelectedFiles(files);
      setDocuments(parsed);
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

  const changeDocumentType = (documentId: string, documentType: ContractUploadDocumentType) => {
    const nextSelected = selectedFiles.map((item) => item.id === documentId ? { ...item, documentType } : item);
    const nextDocuments = documents.map((document) => (
      document.id === documentId ? { ...document, documentType } : document
    ));
    setSelectedFiles(nextSelected);
    setDocuments(nextDocuments);
  };

  const save = () => {
    if (!selectedProject || !selectedCreator || !selectedFiles.length || !documents.length) return;
    const reference = selectedProject.creatorProfiles?.find((creator) => creator.creatorId === selectedCreator.id);
    if (!reference) {
      setError('当前项目达人缺少稳定 Engagement ID，需先在项目详情中完成关联。');
      return;
    }
    const selectedDraft = draftCandidates.find((contract) => contract.contractId === draftContractId);
    const sourceDocuments = documents.map((document) => {
      const selected = selectedFiles.find((item) => item.id === document.id);
      return {
        ...document,
        documentUrl: selected ? URL.createObjectURL(selected.file) : '',
      };
    });
    onSave({
      systemContractNumber: selectedDraft?.id ?? systemContractNumber,
      projectId: (selectedProject.projectId ?? selectedProject.id) as ProjectId,
      projectName: selectedProject.name,
      customer: selectedProject.brand,
      creatorId: selectedCreator.id as CreatorId,
      creatorName: selectedCreator.name,
      creatorHandle: selectedCreator.handle,
      creatorPlatform: selectedCreator.platform,
      engagementId: reference.engagementId as EngagementId,
      draftContractId: selectedDraft?.contractId as ContractId | undefined,
      recognitionResults: fields,
      sourceDocuments,
    });
  };

  return (
    <Modal
      title="上传合同"
      onClose={onClose}
      width="1080px"
      className="contract-upload-modal"
      footer={(
        <>
          <div className="contract-upload-footer-status" aria-live="polite">
            <span>{documents.length ? `${documents.length} 份文件已解析` : '尚未选择合同文件'}</span>
            <small>{documents.length ? `${fields.length} 个字段 · ${conflictCount} 项需核对 · ${missingCount} 项待补充` : '完成关联信息并上传文件后可保存'}</small>
          </div>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button type="submit" form="contract-upload-form" disabled={!canSave}>保存待确认合同</Button>
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
              <span>关联项目 *</span>
              <SelectField
                ariaLabel="关联项目"
                variant="form"
                value={projectId}
                placeholder="选择项目"
                options={projectOptions}
                onChange={(value) => {
                  setProjectId(value);
                  setCreatorId('');
                  setDraftContractId('');
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
                placeholder={selectedProject ? '选择该项目达人' : '请先选择项目'}
                options={creatorOptions}
                disabled={!selectedProject}
                onChange={(value) => {
                  setCreatorId(value);
                  setDraftContractId('');
                }}
              />
              <small>{selectedProject ? `仅显示 ${selectedProject.name} 已关联的达人` : '选择项目后加载关联达人'}</small>
            </div>
            <div className="contract-upload-field">
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
                onChange={setDraftContractId}
              />
              <small>选择后沿用草稿合同 ID，并保留原生成快照</small>
            </div>
          </div>
          {selectedProject && projectCreators.length === 0 ? (
            <p className="contract-upload-empty">该项目没有可验证的达人关联，请先维护项目合作达人。</p>
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
              <p>支持文字型 PDF 与标准 DOCX，每份文件由用户选择“合同”或“IO 单”。</p>
            </div>
            {documents.length ? <em>{documents.length} 份</em> : null}
          </header>
          <div className="contract-upload-file-grid">
            <label className={`contract-file-drop${!selectedCreator ? ' disabled' : ''}`}>
              {parsing ? <LoaderCircle className="contract-upload-spinner" size={24} /> : <Upload size={24} />}
              <strong>{parsing ? '正在浏览器本地解析…' : selectedCreator ? '点击选择合同文件' : '请先完成项目与达人关联'}</strong>
              <small>最多 {MAX_CONTRACT_FILE_COUNT} 份，单份不超过 30 MB</small>
              <span>{selectedFiles.length ? '重新选择文件' : '选择 PDF / DOCX'}</span>
              <input
                className="contract-file-input"
                type="file"
                aria-label="选择合同文件"
                multiple
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
                <select
                  aria-label={`${document.fileName} 文档类型`}
                  value={document.documentType}
                  onChange={(event) => changeDocumentType(document.id, event.target.value as ContractUploadDocumentType)}
                >
                  {CONTRACT_UPLOAD_DOCUMENT_TYPE_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
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
