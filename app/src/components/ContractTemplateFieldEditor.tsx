import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Power,
  PowerOff,
  Save,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type {
  ContractRecord,
  ContractTemplateFieldMode,
  ContractTemplateFieldPolicyMap,
  ContractTemplateOutputFieldKey,
} from '../contracts';
import {
  CONTRACT_TEMPLATE_FIELD_GROUPS,
  CONTRACT_TEMPLATE_FIELD_MODES,
  CONTRACT_TEMPLATE_OUTPUT_FIELDS,
  contractTemplatePoliciesAreDirty,
  createContractTemplatePolicyUpdate,
  createContractTemplateStatusUpdate,
  getContractTemplatePolicyReadiness,
  getContractTemplateStatus,
  resolveContractTemplateFieldPolicies,
  resolveContractTemplateOutputFieldKeys,
  type ContractTemplateFieldGroupKey,
  type ContractTemplatePolicyIssue,
} from '../contractTemplateFieldPolicies';
import { Button, Modal } from './Common';

type Props = {
  contract: ContractRecord;
  canEdit: boolean;
  onSave?: (contract: ContractRecord) => void;
  onDirtyChange?: (dirty: boolean) => void;
  notify: (title: string, message: string) => void;
};

type ConfirmationKind = 'DEACTIVATE' | 'SAVE_AND_DEACTIVATE' | null;

const groupForIssue = (issue: ContractTemplatePolicyIssue): ContractTemplateFieldGroupKey => (
  issue.groupKeys[0]
  ?? CONTRACT_TEMPLATE_OUTPUT_FIELDS.find((field) => issue.fieldKeys.includes(field.key))?.group
  ?? 'COMMON'
);

export function ContractTemplateFieldEditor({
  contract,
  canEdit,
  onSave,
  onDirtyChange,
  notify,
}: Props) {
  const resolvedPolicies = useMemo(
    () => resolveContractTemplateFieldPolicies(contract.templateFieldPolicies),
    [contract.templateFieldPolicies],
  );
  const resolvedFieldKeys = useMemo(
    () => resolveContractTemplateOutputFieldKeys(contract.templateOutputFieldKeys),
    [contract.templateOutputFieldKeys],
  );
  const [draftPolicies, setDraftPolicies] = useState(resolvedPolicies);
  const [savedPolicies, setSavedPolicies] = useState<ContractTemplateFieldPolicyMap>(resolvedPolicies);
  const [draftFieldKeys, setDraftFieldKeys] = useState(resolvedFieldKeys);
  const [savedFieldKeys, setSavedFieldKeys] = useState(resolvedFieldKeys);
  const [activeGroup, setActiveGroup] = useState<ContractTemplateFieldGroupKey>('COMMON');
  const [confirmation, setConfirmation] = useState<ConfirmationKind>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const [invalidFields, setInvalidFields] = useState<ContractTemplateOutputFieldKey[]>([]);
  const dirty = contractTemplatePoliciesAreDirty(
    savedPolicies,
    draftPolicies,
    savedFieldKeys,
    draftFieldKeys,
  );
  const readiness = getContractTemplatePolicyReadiness(draftPolicies, draftFieldKeys);
  const templateStatus = getContractTemplateStatus(contract);

  useEffect(() => {
    setDraftPolicies(resolvedPolicies);
    setSavedPolicies(resolvedPolicies);
    setDraftFieldKeys(resolvedFieldKeys);
    setSavedFieldKeys(resolvedFieldKeys);
    setActiveGroup('COMMON');
    setFeedback(null);
    setInvalidFields([]);
    setConfirmation(null);
  }, [contract.id]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const revealIssues = (issues: ContractTemplatePolicyIssue[]) => {
    const fields = [...new Set(issues.flatMap((issue) => issue.fieldKeys))];
    setInvalidFields(fields);
    if (issues[0]) setActiveGroup(groupForIssue(issues[0]));
  };

  const updateMode = (key: ContractTemplateOutputFieldKey, mode: ContractTemplateFieldMode) => {
    if (!canEdit) return;
    setDraftPolicies((current) => ({ ...current, [key]: mode }));
    setFeedback(null);
    setInvalidFields((current) => current.filter((field) => field !== key));
  };

  const removeField = (key: ContractTemplateOutputFieldKey) => {
    if (!canEdit) return;
    setDraftFieldKeys((current) => current.filter((field) => field !== key));
    setFeedback(null);
    setInvalidFields((current) => current.filter((field) => field !== key));
  };

  const addField = (key: ContractTemplateOutputFieldKey) => {
    if (!canEdit) return;
    setDraftFieldKeys((current) => resolveContractTemplateOutputFieldKeys([...current, key]));
    setFeedback(null);
    setInvalidFields((current) => current.filter((field) => field !== key));
  };

  const persistConfiguration = (deactivateIfInvalid: boolean) => {
    if (!onSave) return;
    const result = createContractTemplatePolicyUpdate(
      contract,
      draftPolicies,
      draftFieldKeys,
      { deactivateIfInvalid },
    );
    onSave(result.contract);
    setSavedPolicies({ ...draftPolicies });
    setSavedFieldKeys([...result.contract.templateOutputFieldKeys!]);
    revealIssues(result.issues);
    if (result.autoDeactivated) {
      setFeedback({ tone: 'warning', message: '字段配置已保存；由于存在阻断项，模板已自动停用。' });
      notify('模板已自动停用', '配置已保存，修复全部阻断项后才能重新启动模板。');
    } else if (result.issues.length) {
      setFeedback({ tone: 'warning', message: '字段配置已保存；模板保持停用，修复阻断项后才能启动。' });
      notify('模板配置已保存', '当前配置仍有阻断项，模板保持停用。');
    } else {
      setFeedback({ tone: 'success', message: '字段配置已保存，新的合同生成任务将使用这份配置。' });
      notify('模板配置已保存', '字段结构和来源策略已更新；历史合同快照不会变化。');
    }
  };

  const save = () => {
    if (!canEdit || !onSave) return;
    if (!readiness.ready && templateStatus === 'ACTIVE') {
      revealIssues(readiness.blockers);
      setConfirmation('SAVE_AND_DEACTIVATE');
      return;
    }
    persistConfiguration(false);
  };

  const activateTemplate = () => {
    if (!onSave) return;
    const result = createContractTemplateStatusUpdate(contract, 'ACTIVE');
    if (!result.contract) {
      revealIssues(result.issues);
      setFeedback({ tone: 'error', message: result.issues[0]?.message ?? '字段配置校验未通过。' });
      notify('模板无法启动', result.issues[0]?.message ?? '请先修复字段配置阻断项。');
      return;
    }
    onSave(result.contract);
    setInvalidFields([]);
    setFeedback({ tone: 'success', message: '模板已启动，可用于新建合同。' });
    notify('模板已启动', '合同管理现在可以使用该模板新建合同。');
  };

  const deactivateTemplate = () => {
    if (!onSave) return;
    const result = createContractTemplateStatusUpdate(contract, 'INACTIVE');
    if (!result.contract) return;
    onSave(result.contract);
    setFeedback({ tone: 'warning', message: '模板已停用；既有草稿和历史合同不受影响。' });
    notify('模板已停用', '新建合同已停止使用该模板，既有草稿仍可继续处理。');
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const lastIndex = CONTRACT_TEMPLATE_FIELD_GROUPS.length - 1;
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? lastIndex
        : event.key === 'ArrowRight'
          ? (index + 1) % CONTRACT_TEMPLATE_FIELD_GROUPS.length
          : (index - 1 + CONTRACT_TEMPLATE_FIELD_GROUPS.length) % CONTRACT_TEMPLATE_FIELD_GROUPS.length;
    const nextGroup = CONTRACT_TEMPLATE_FIELD_GROUPS[nextIndex];
    setActiveGroup(nextGroup.key);
    document.getElementById(`contract-template-tab-${nextGroup.key}`)?.focus();
  };

  const activeGroupDefinition = CONTRACT_TEMPLATE_FIELD_GROUPS.find((group) => group.key === activeGroup)!;
  const catalogFields = CONTRACT_TEMPLATE_OUTPUT_FIELDS.filter((field) => field.group === activeGroup);
  const visibleFields = catalogFields.filter((field) => draftFieldKeys.includes(field.key));
  const removedFields = catalogFields.filter((field) => !draftFieldKeys.includes(field.key));

  return (
    <div className="contract-template-editor" data-testid="contract-template-field-editor">
      <header className="contract-template-editor-heading">
        <span><SlidersHorizontal size={18} aria-hidden="true" /></span>
        <div>
          <strong>合同编辑器</strong>
          <small>按字段组维护模板结构和生成来源</small>
        </div>
        <div className="contract-template-editor-status-actions">
          <span className={`contract-template-status contract-template-status-${templateStatus.toLowerCase()}`}>
            {templateStatus === 'ACTIVE' ? '已启动' : '已停用'}
          </span>
          <Button
            variant={templateStatus === 'ACTIVE' ? 'danger' : 'secondary'}
            icon={templateStatus === 'ACTIVE' ? <PowerOff size={15} /> : <Power size={15} />}
            disabled={!canEdit || !onSave || dirty}
            disabledReason={!canEdit
              ? '当前账号没有模板编辑权限。'
              : !onSave
                ? '当前模板无法更新状态。'
                : dirty
                  ? '请先保存字段配置，再修改模板状态。'
                  : undefined}
            onClick={() => {
              if (templateStatus === 'ACTIVE') setConfirmation('DEACTIVATE');
              else activateTemplate();
            }}
          >
            {templateStatus === 'ACTIVE' ? '停用模板' : '启动模板'}
          </Button>
        </div>
      </header>

      <div className="contract-template-editor-intro">
        <p>删除字段会将其移入当前页的“添加字段”列表；原来源策略会保留，重新添加后继续使用。人工值只进入合同文档快照，不会修改达人已验证账户。</p>
      </div>

      <div className="contract-template-editor-tabs" role="tablist" aria-label="合同模板字段组">
        {CONTRACT_TEMPLATE_FIELD_GROUPS.map((group, index) => {
          const groupFields = CONTRACT_TEMPLATE_OUTPUT_FIELDS.filter((field) => field.group === group.key);
          const activeCount = groupFields.filter((field) => draftFieldKeys.includes(field.key)).length;
          const issueCount = readiness.blockers.filter((issue) => issue.groupKeys.includes(group.key)).length;
          return (
            <button
              id={`contract-template-tab-${group.key}`}
              className={activeGroup === group.key ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={activeGroup === group.key}
              aria-controls={`contract-template-panel-${group.key}`}
              tabIndex={activeGroup === group.key ? 0 : -1}
              key={group.key}
              onClick={() => setActiveGroup(group.key)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              <span>{group.label}</span>
              <small>{activeCount}/{groupFields.length}{issueCount ? ` · ${issueCount} 项问题` : ''}</small>
            </button>
          );
        })}
      </div>

      <section
        id={`contract-template-panel-${activeGroup}`}
        className="contract-template-field-group contract-template-field-panel"
        role="tabpanel"
        aria-labelledby={`contract-template-tab-${activeGroup}`}
      >
        <div className="contract-template-field-group-heading">
          <div>
            <h3>{activeGroupDefinition.label}</h3>
            <p>{activeGroupDefinition.description}</p>
          </div>
          <label className="contract-template-add-field">
            <span><Plus size={14} aria-hidden="true" />添加字段</span>
            <select
              aria-label={`向${activeGroupDefinition.label}添加字段`}
              value=""
              disabled={!canEdit || removedFields.length === 0}
              onChange={(event) => {
                if (event.target.value) addField(event.target.value as ContractTemplateOutputFieldKey);
              }}
            >
              <option value="">{removedFields.length ? '选择要恢复的字段' : '全部字段已添加'}</option>
              {removedFields.map((field) => <option value={field.key} key={field.key}>{field.label}</option>)}
            </select>
          </label>
        </div>

        {visibleFields.length ? (
          <div className="contract-template-field-list">
            {visibleFields.map((field) => (
              <fieldset
                className={`contract-template-field-row${invalidFields.includes(field.key) ? ' has-error' : ''}`}
                key={field.key}
                data-template-output-field={field.key}
              >
                <legend className="sr-only">{field.label} 字段来源</legend>
                <div className="contract-template-field-row-heading">
                  <div className="contract-template-field-copy">
                    <strong>{field.label}</strong>
                    <small>{field.description}</small>
                  </div>
                  <button
                    className="contract-template-remove-field"
                    type="button"
                    disabled={!canEdit}
                    aria-label={`删除字段 ${field.label}`}
                    title={`从${activeGroupDefinition.label}移除 ${field.label}`}
                    onClick={() => removeField(field.key)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    <span>删除字段</span>
                  </button>
                </div>
                <div className="contract-template-mode-options" aria-label={`${field.label} 字段来源`}>
                  {CONTRACT_TEMPLATE_FIELD_MODES.map((mode) => {
                    const inputId = `template-field-${field.key}-${mode.value}`;
                    return (
                      <label className={draftPolicies[field.key] === mode.value ? 'is-selected' : ''} htmlFor={inputId} key={mode.value} title={mode.description}>
                        <input
                          id={inputId}
                          type="radio"
                          name={`template-field-${field.key}`}
                          value={mode.value}
                          checked={draftPolicies[field.key] === mode.value}
                          disabled={!canEdit}
                          onChange={() => updateMode(field.key, mode.value)}
                        />
                        <span>{mode.label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        ) : (
          <div className="contract-template-field-empty" role="status">
            <span><AlertTriangle size={18} aria-hidden="true" /></span>
            <div>
              <strong>{activeGroup === 'COMMON' ? '通用字段不能为空' : `${activeGroupDefinition.label.replace('字段', '')}已关闭`}</strong>
              <p>{activeGroup === 'COMMON'
                ? '请通过“添加字段”恢复合同正文必需字段，当前模板无法启动。'
                : `新建合同时不会提供${activeGroup === 'BANK' ? '银行转账' : 'PayPal'}付款方式。`}</p>
            </div>
          </div>
        )}
      </section>

      {feedback ? (
        <div className={`contract-template-save-feedback is-${feedback.tone}`} role={feedback.tone === 'success' ? 'status' : 'alert'} aria-live="polite">
          {feedback.tone === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{feedback.message}</span>
        </div>
      ) : null}

      <footer className="contract-template-editor-actions">
        <span>{dirty ? '有未保存的修改' : readiness.ready ? '当前配置可用于启动和正式生成' : `${readiness.blockers.length} 项配置会阻止模板启动`}</span>
        <Button
          icon={<Save size={16} />}
          disabled={!dirty || !canEdit || !onSave}
          disabledReason={!canEdit ? '当前账号没有模板编辑权限。' : !onSave ? '当前模板无法保存。' : '当前没有待保存的修改。'}
          onClick={save}
        >
          保存配置
        </Button>
      </footer>

      {confirmation ? (
        <Modal
          title={confirmation === 'DEACTIVATE' ? '停用合同模板' : '保存配置并停用模板'}
          width="480px"
          className="contract-template-status-modal"
          onClose={() => setConfirmation(null)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setConfirmation(null)}>取消</Button>
              <Button
                variant="danger"
                icon={<PowerOff size={15} />}
                onClick={() => {
                  if (confirmation === 'DEACTIVATE') deactivateTemplate();
                  else persistConfiguration(true);
                  setConfirmation(null);
                }}
              >
                {confirmation === 'DEACTIVATE' ? '确认停用' : '保存并停用'}
              </Button>
            </>
          )}
        >
          <div className="contract-template-status-confirmation">
            <span><AlertTriangle size={22} aria-hidden="true" /></span>
            <div>
              <strong>{confirmation === 'DEACTIVATE' ? '停用后不能用于新建合同' : '当前配置未通过启动校验'}</strong>
              <p>{confirmation === 'DEACTIVATE'
                ? '既有草稿和历史合同继续使用各自冻结的字段快照，不会受到影响。'
                : '保存后模板将自动停用；请修复页签中的阻断项，再重新启动模板。'}</p>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
