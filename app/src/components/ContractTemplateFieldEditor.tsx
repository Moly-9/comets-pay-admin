import {
  AlertTriangle,
  CheckCircle2,
  PowerOff,
  Save,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  CONTRACT_TEMPLATE_EDITABLE_OUTPUT_FIELDS,
  contractTemplatePoliciesAreDirty,
  createContractTemplatePolicyUpdate,
  getContractTemplatePolicyReadiness,
  getContractTemplateStatus,
  resolveEditableContractTemplateFieldPolicies,
  type ContractTemplateFieldGroupKey,
  type ContractTemplatePolicyIssue,
} from '../contractTemplateFieldPolicies';
import { Button, Modal } from './Common';

type Props = {
  contract: ContractRecord;
  canEdit: boolean;
  onSave?: (contract: ContractRecord) => void;
  onDirtyChange?: (dirty: boolean) => void;
  validationIssues?: ContractTemplatePolicyIssue[];
  notify: (title: string, message: string) => void;
};

type ConfirmationKind = 'SAVE_AND_DEACTIVATE' | null;

const groupForIssue = (issue: ContractTemplatePolicyIssue): ContractTemplateFieldGroupKey => (
  issue.groupKeys[0]
  ?? CONTRACT_TEMPLATE_EDITABLE_OUTPUT_FIELDS.find((field) => issue.fieldKeys.includes(field.key))?.group
  ?? 'COMMON'
);

export function ContractTemplateFieldEditor({
  contract,
  canEdit,
  onSave,
  onDirtyChange,
  validationIssues,
  notify,
}: Props) {
  const resolvedPolicies = useMemo(
    () => resolveEditableContractTemplateFieldPolicies(contract.templateFieldPolicies),
    [contract.templateFieldPolicies],
  );
  const [draftPolicies, setDraftPolicies] = useState(resolvedPolicies);
  const [savedPolicies, setSavedPolicies] = useState<ContractTemplateFieldPolicyMap>(resolvedPolicies);
  const [activeGroup, setActiveGroup] = useState<ContractTemplateFieldGroupKey>('COMMON');
  const [confirmation, setConfirmation] = useState<ConfirmationKind>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const [invalidFields, setInvalidFields] = useState<ContractTemplateOutputFieldKey[]>([]);
  const onDirtyChangeRef = useRef(onDirtyChange);
  const dirty = contractTemplatePoliciesAreDirty(savedPolicies, draftPolicies);
  const readiness = getContractTemplatePolicyReadiness(draftPolicies);
  const templateStatus = getContractTemplateStatus(contract);

  useEffect(() => {
    setDraftPolicies(resolvedPolicies);
    setSavedPolicies(resolvedPolicies);
    setActiveGroup('COMMON');
    setFeedback(null);
    setInvalidFields([]);
    setConfirmation(null);
  }, [contract.id]);

  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  }, [onDirtyChange]);

  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);

  const revealIssues = (issues: ContractTemplatePolicyIssue[]) => {
    const fields = [...new Set(issues.flatMap((issue) => issue.fieldKeys))];
    setInvalidFields(fields);
    if (issues[0]) setActiveGroup(groupForIssue(issues[0]));
  };

  useEffect(() => {
    if (!validationIssues?.length) return;
    revealIssues(validationIssues);
    setFeedback({ tone: 'error', message: validationIssues[0].message });
  }, [validationIssues]);

  const updateMode = (key: ContractTemplateOutputFieldKey, mode: ContractTemplateFieldMode) => {
    if (!canEdit) return;
    setDraftPolicies((current) => ({ ...current, [key]: mode }));
    setFeedback(null);
    setInvalidFields((current) => current.filter((field) => field !== key));
  };

  const persistConfiguration = (deactivateIfInvalid: boolean) => {
    if (!onSave) return;
    const result = createContractTemplatePolicyUpdate(
      contract,
      draftPolicies,
      { deactivateIfInvalid },
    );
    onSave(result.contract);
    setSavedPolicies({ ...draftPolicies });
    revealIssues(result.issues);
    if (result.autoDeactivated) {
      setFeedback({ tone: 'warning', message: '字段配置已保存；由于存在阻断项，模板已自动停用。' });
      notify('模板已自动停用', '配置已保存，修复全部阻断项后才能重新启动模板。');
    } else if (result.issues.length) {
      setFeedback({ tone: 'warning', message: '字段配置已保存；模板保持停用，修复阻断项后才能启动。' });
      notify('模板配置已保存', '当前配置仍有阻断项，模板保持停用。');
    } else {
      setFeedback({ tone: 'success', message: '字段配置已保存，新的合同生成任务将使用这份配置。' });
      notify('模板配置已保存', '字段来源策略已更新；历史合同快照不会变化。');
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
  const visibleFields = CONTRACT_TEMPLATE_EDITABLE_OUTPUT_FIELDS.filter((field) => field.group === activeGroup);

  return (
    <div className="contract-template-editor" data-testid="contract-template-field-editor">
      <header className="contract-template-editor-heading">
        <span><SlidersHorizontal size={18} aria-hidden="true" /></span>
        <div>
          <strong>合同编辑器</strong>
          <small>按字段组维护模板的生成来源</small>
        </div>
      </header>

      <div className="contract-template-editor-intro">
        <p>为每个字段选择“系统自动带入 / 生成时人工填写”。人工值只进入合同文档快照，不会修改达人已验证账户。</p>
      </div>

      <div className="contract-template-editor-tabs" role="tablist" aria-label="合同模板字段组">
        {CONTRACT_TEMPLATE_FIELD_GROUPS.map((group, index) => (
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
          </button>
        ))}
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
        </div>

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
          title="保存配置并停用模板"
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
                  persistConfiguration(true);
                  setConfirmation(null);
                }}
              >
                保存并停用
              </Button>
            </>
          )}
        >
          <div className="contract-template-status-confirmation">
            <span><AlertTriangle size={22} aria-hidden="true" /></span>
            <div>
              <strong>当前配置未通过启动校验</strong>
              <p>保存后模板将自动停用；请修复页签中的阻断项，再重新启动模板。</p>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
