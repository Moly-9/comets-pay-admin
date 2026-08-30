import { AlertTriangle, CheckCircle2, Save, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
  getContractTemplatePolicyReadiness,
  resolveContractTemplateFieldPolicies,
} from '../contractTemplateFieldPolicies';
import { Button } from './Common';

type Props = {
  contract: ContractRecord;
  canEdit: boolean;
  onSave?: (contract: ContractRecord) => void;
  onDirtyChange?: (dirty: boolean) => void;
  notify: (title: string, message: string) => void;
};

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
  const [draftPolicies, setDraftPolicies] = useState(resolvedPolicies);
  const [savedPolicies, setSavedPolicies] = useState<ContractTemplateFieldPolicyMap>(resolvedPolicies);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [invalidFields, setInvalidFields] = useState<ContractTemplateOutputFieldKey[]>([]);
  const dirty = contractTemplatePoliciesAreDirty(savedPolicies, draftPolicies);
  const readiness = getContractTemplatePolicyReadiness(draftPolicies);

  useEffect(() => {
    setDraftPolicies(resolvedPolicies);
    setSavedPolicies(resolvedPolicies);
    setFeedback(null);
    setInvalidFields([]);
  }, [contract.id]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const updateMode = (key: ContractTemplateOutputFieldKey, mode: ContractTemplateFieldMode) => {
    if (!canEdit) return;
    setDraftPolicies((current) => ({ ...current, [key]: mode }));
    setFeedback(null);
    setInvalidFields((current) => current.filter((field) => field !== key));
  };

  const save = () => {
    if (!canEdit || !onSave) return;
    const result = createContractTemplatePolicyUpdate(contract, draftPolicies);
    const issues = result.issues;
    if (issues.length) {
      const fields = [...new Set(issues.flatMap((issue) => issue.fieldKeys))];
      setInvalidFields(fields);
      setFeedback({ tone: 'error', message: issues[0].message });
      notify('模板配置保存失败', issues[0].message);
      return;
    }
    onSave(result.contract!);
    setSavedPolicies({ ...draftPolicies });
    setInvalidFields([]);
    setFeedback({ tone: 'success', message: '字段策略已保存，新的合同生成任务将使用这份配置。' });
    notify('模板配置已保存', '字段来源策略已更新；已生成合同的历史快照不会变化。');
  };

  return (
    <div className="contract-template-editor" data-testid="contract-template-field-editor">
      <header className="contract-template-editor-heading">
        <span><SlidersHorizontal size={18} aria-hidden="true" /></span>
        <div>
          <strong>合同编辑器</strong>
          <small>制定字段在生成合同时的来源策略</small>
        </div>
        <span className={`contract-template-readiness contract-template-readiness-${readiness.ready ? 'ready' : 'attention'}`}>
          {readiness.label}
        </span>
      </header>

      <div className="contract-template-editor-intro">
        <p>“人工填写”的值只进入合同文档快照，不会修改达人已验证的收款账户；与账户不一致时仍需人工核对。</p>
      </div>

      {CONTRACT_TEMPLATE_FIELD_GROUPS.map((group) => (
        <section className="contract-template-field-group" aria-labelledby={`contract-template-group-${group.key}`} key={group.key}>
          <div className="contract-template-field-group-heading">
            <div>
              <h3 id={`contract-template-group-${group.key}`}>{group.label}</h3>
              <p>{group.description}</p>
            </div>
            <span>{CONTRACT_TEMPLATE_OUTPUT_FIELDS.filter((field) => field.group === group.key).length} 项</span>
          </div>
          <div className="contract-template-field-list">
            {CONTRACT_TEMPLATE_OUTPUT_FIELDS.filter((field) => field.group === group.key).map((field) => (
              <fieldset
                className={`contract-template-field-row${invalidFields.includes(field.key) ? ' has-error' : ''}`}
                key={field.key}
                data-template-output-field={field.key}
              >
                <legend className="sr-only">{field.label} 字段来源</legend>
                <div className="contract-template-field-copy">
                  <strong>{field.label}</strong>
                  <small>{field.description}</small>
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
      ))}

      {feedback ? (
        <div className={`contract-template-save-feedback is-${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'} aria-live="polite">
          {feedback.tone === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{feedback.message}</span>
        </div>
      ) : null}

      <footer className="contract-template-editor-actions">
        <span>{dirty ? '有未保存的修改' : readiness.ready ? '当前配置可用于正式生成' : `${readiness.blockers.length} 项配置会阻止正式生成`}</span>
        <Button
          icon={<Save size={16} />}
          disabled={!dirty || !canEdit || !onSave}
          disabledReason={!canEdit ? '当前账号没有模板编辑权限。' : !onSave ? '当前模板无法保存。' : '当前没有待保存的修改。'}
          onClick={save}
        >
          保存配置
        </Button>
      </footer>
    </div>
  );
}
