import { Check, FileText, Search, Upload, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { parseContractFile } from '../contractFileParser';
import type { ContractFieldReview, ContractUploadInput } from '../contracts';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import type { CreatorProfile } from '../types';
import { Button, Modal } from './Common';

type Props = {
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  onClose: () => void;
  onSave: (input: ContractUploadInput) => void;
};

const MAX_FILE_SIZE = 30 * 1024 * 1024;

export function ContractUploadWizard({ projects, creators, onClose, onSave }: Props) {
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState('');
  const [creatorId, setCreatorId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<ContractFieldReview[]>([]);
  const [parseNote, setParseNote] = useState('');
  const [error, setError] = useState('');
  const [parsing, setParsing] = useState(false);
  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const visibleProjects = projects.filter((project) => (
    `${project.name}${project.id}${project.brand}`.toLowerCase().includes(search.trim().toLowerCase())
  ));
  const projectCreators = useMemo(() => {
    if (!selectedProject) return [];
    const references = selectedProject.creatorProfiles ?? [];
    if (references.length > 0) {
      return references.map((reference) => creators.find((creator) => creator.id === reference.creatorId))
        .filter((creator): creator is CreatorProfile => Boolean(creator));
    }
    return [];
  }, [creators, selectedProject]);
  const selectedCreator = projectCreators.find((creator) => creator.id === creatorId) ?? null;
  const missingRequired = fields.filter((field) => field.required && !field.value.trim());

  const selectFile = async (nextFile: File | undefined) => {
    if (!nextFile || !selectedCreator) return;
    setError('');
    if (!/\.(pdf|doc|docx)$/i.test(nextFile.name)) {
      setError('仅支持 PDF、DOC 或 DOCX 文件。');
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setError('文件不能超过 30 MB。');
      return;
    }
    setFile(nextFile);
    setParsing(true);
    try {
      const result = await parseContractFile(nextFile, selectedCreator.name);
      setFields(result.fields);
      setParseNote(result.note ?? '');
      setStep(4);
    } catch (reason) {
      setFields([]);
      setParseNote(reason instanceof Error ? reason.message : '文件解析失败，请人工核对原文件。');
      setStep(4);
    } finally {
      setParsing(false);
    }
  };

  const save = () => {
    if (!selectedProject || !selectedCreator || !file || missingRequired.length > 0) return;
    const reference = selectedProject.creatorProfiles?.find((creator) => creator.creatorId === selectedCreator.id);
    onSave({
      file,
      documentUrl: URL.createObjectURL(file),
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      customer: selectedProject.brand,
      creatorId: selectedCreator.id,
      creatorName: selectedCreator.name,
      creatorHandle: selectedCreator.handle,
      creatorPlatform: selectedCreator.platform,
      engagementId: reference?.engagementId ?? `ENG-${selectedProject.id}-${selectedCreator.id}`,
      fields,
      parseNote,
    });
  };

  return (
    <Modal
      title="上传合同"
      onClose={onClose}
      width="860px"
      footer={(
        <>
          {step > 1 && step < 5 ? <Button variant="ghost" onClick={() => setStep((current) => current - 1)}>上一步</Button> : null}
          {step === 1 ? <Button disabled={!projectId} onClick={() => setStep(2)}>下一步</Button> : null}
          {step === 2 ? <Button disabled={!creatorId} onClick={() => setStep(3)}>下一步</Button> : null}
          {step === 4 ? <Button disabled={!file || missingRequired.length > 0} onClick={() => setStep(5)}>确认字段</Button> : null}
          {step === 5 ? <Button onClick={save}>保存合同</Button> : null}
        </>
      )}
    >
      <ol className="contract-upload-steps" aria-label="合同上传步骤">
        {['选择项目', '选择达人', '上传文件', '核对字段', '保存合同'].map((label, index) => (
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
            {projectCreators.length === 0 ? <p className="contract-upload-empty">该项目只有历史数量快照，没有可验证的达人关联。请先回到项目详情重新维护合作达人。</p> : null}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="contract-upload-pane">
          <label className="contract-file-drop">
            <Upload size={24} />
            <strong>{parsing ? '正在本地解析…' : '选择 Word 或 PDF'}</strong>
            <small>支持 PDF、DOC、DOCX，单个文件不超过 30 MB。</small>
            <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={parsing} onChange={(event) => void selectFile(event.target.files?.[0])} />
          </label>
          {error ? <p className="contract-upload-error" role="alert">{error}</p> : null}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="contract-upload-pane">
          {parseNote ? <p className="contract-upload-warning">{parseNote}</p> : null}
          <div className="contract-field-review">
            {fields.map((field) => (
              <label key={field.key}>
                <span>{field.label}{field.required ? ' *' : ''}<small>{field.source}</small></span>
                <input value={field.value} placeholder="待补充" onChange={(event) => setFields((current) => current.map((item) => item.key === field.key ? { ...item, value: event.target.value, source: '人工复核' } : item))} />
              </label>
            ))}
          </div>
          {missingRequired.length > 0 ? <p className="contract-upload-error">请补充：{missingRequired.map((field) => field.label).join('、')}</p> : null}
        </div>
      ) : null}

      {step === 5 ? (
        <div className="contract-upload-summary">
          <Check size={28} />
          <h3>字段复核已完成</h3>
          <p>{selectedProject?.name} · {selectedCreator?.name} · {file?.name}</p>
          <small>保存后状态为“待签署”。字段确认不会将合同标记为已签署或可付款。</small>
        </div>
      ) : null}
    </Modal>
  );
}
