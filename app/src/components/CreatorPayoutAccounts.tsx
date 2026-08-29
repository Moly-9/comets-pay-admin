import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  CloudCog,
  Landmark,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  Wallet,
  WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AIRWALLEX_COUNTRIES,
  AIRWALLEX_CURRENCIES,
  canDeletePayoutAccount,
  createEmptyAirwallexAccount,
  deletePayoutAccount,
  getDefaultPayoutAccount,
  getPayoutAccountIdentifier,
  getPayoutAccountStatusMeta,
  getPayoutAccountSummary,
  isPayoutAccountVerified,
  invalidateAirwallexVerification,
  normalizePayMaxStatus,
  normalizePayPalStatus,
} from '../payoutAccounts';
import {
  AIRWALLEX_FORM_SCHEMA_API_PATH,
  AIRWALLEX_LOCAL_CLEARING_SYSTEM_PATH,
  AIRWALLEX_SCHEMA_API_VERSION,
  applyAirwallexSchemaDefaults,
  generateLocalAirwallexFormSchema,
  getAirwallexFormValue,
  getAirwallexSchemaConditionKey,
  getAirwallexSchemaGroup,
  prioritizeAirwallexLocalClearingOptions,
  setAirwallexFormValue,
  validateAirwallexFormSchema,
  type AirwallexFormSchemaField,
  type AirwallexFormSchemaOption,
} from '../airwallexFormSchema';
import {
  getAirwallexBeneficiaryFormSchema,
  getAirwallexDynamicOptions,
  synchronizeAirwallexBeneficiary,
} from '../airwallexBeneficiaryApi';
import { getAirwallexUsPaymentSupplementalFields } from '../airwallexSupplementalFields';
import type {
  AirwallexPayoutAccount,
  CreatorPayoutAccount,
  PayMaxPayoutAccount,
  PayPalPayoutAccount,
} from '../types';
import { Button, Modal, SelectField } from './Common';
import { paymentProviderDisplayName } from './PaymentProviderBadge';

type CreatorPayoutAccountsProps = {
  accounts: CreatorPayoutAccount[];
  editing?: boolean;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  validationAttempt?: number;
  focusValidationError?: boolean;
  onChange?: (accounts: CreatorPayoutAccount[]) => void;
};

const DOCUMENT_PAYOUT_FIELD_LABELS: Record<string, { label: string; alias: string; example: string }> = {
  'beneficiary.bank_details.account_name': {
    label: 'Account Name',
    alias: '账户名称',
    example: 'Taylor Morgan',
  },
  'beneficiary.bank_details.account_number': {
    label: 'Account Number',
    alias: '银行账号',
    example: '50001121',
  },
  'beneficiary.bank_details.bank_account_category': {
    label: 'Account Type',
    alias: '账户类型',
    example: 'Checking',
  },
  'beneficiary.bank_details.bank_name': {
    label: "Beneficiary's Bank Name",
    alias: '收款银行名称',
    example: 'JPMorgan Chase Bank',
  },
  'beneficiary.bank_details.bank_street_address': {
    label: "Beneficiary's Bank Address",
    alias: '收款银行地址',
    example: '270 Park Avenue, New York, NY 10017',
  },
  'profile_supplement.beneficiary_bank_address': {
    label: "Beneficiary's Bank Address",
    alias: '收款银行地址',
    example: '270 Park Avenue, New York, NY 10017',
  },
  'beneficiary.bank_details.swift_code': {
    label: "Beneficiary's Bank SWIFT Code",
    alias: '收款银行 SWIFT / BIC',
    example: 'CHASUS33',
  },
  'beneficiary.bank_details.iban': {
    label: 'IBAN',
    alias: '国际银行账号',
    example: 'GB29NWBK60161331926819',
  },
  'beneficiary.bank_details.bank_country_code': {
    label: "Beneficiary's Bank Country",
    alias: '收款银行国家 / 地区',
    example: 'US',
  },
  'beneficiary.bank_details.bank_state': {
    label: "Beneficiary's Bank State",
    alias: '收款银行州 / 省',
    example: 'New York',
  },
  'beneficiary.bank_details.bank_city': {
    label: "Beneficiary's Bank City",
    alias: '收款银行城市',
    example: 'New York',
  },
  'beneficiary.bank_details.bank_postcode': {
    label: "Beneficiary's Bank Postal Code",
    alias: '收款银行邮政编码',
    example: '10017',
  },
  'beneficiary.bank_details.intermediary_bank_country_code': {
    label: 'Intermediary Bank Country (if any)',
    alias: '中间行国家 / 地区 · 选填',
    example: 'US',
  },
  'beneficiary.bank_details.intermediary_bank_swift_code': {
    label: 'Intermediary Bank Code (if any)',
    alias: '中间行代码 · 选填',
    example: 'CHASUS33',
  },
  'beneficiary.additional_info.transfer_remarks': {
    label: 'Transfer Remarks (if any)',
    alias: '转账备注 · 选填',
    example: 'Creator campaign payout Aug 2026',
  },
  'beneficiary.bank_details.account_routing_type1': {
    label: 'Primary Routing Code Type',
    alias: '银行一级路由号类型',
    example: 'ABA',
  },
  'beneficiary.bank_details.account_routing_value2': {
    label: 'Primary Branch Code',
    alias: '分行代码',
    example: '001',
  },
  'beneficiary.additional_info.personal_id_type': {
    label: 'ID Document Type',
    alias: '证件类型',
    example: 'PASSPORT',
  },
  'beneficiary.additional_info.personal_id_number': {
    label: 'Beneficiary ID Number',
    alias: '证件号',
    example: 'P12345678',
  },
  'beneficiary.additional_info.business_registration_number': {
    label: 'Business Registration Number',
    alias: '企业注册号码',
    example: '12-3456789',
  },
};

const REQUESTED_PAYMENT_FIELD_PATHS = new Set([
  'beneficiary.bank_details.account_name',
  'beneficiary.bank_details.beneficiary_name',
  'beneficiary.bank_details.account_holder_name',
  'beneficiary.bank_details.account_number',
  'beneficiary.bank_details.bank_account_number',
  'beneficiary.bank_details.bank_account_category',
  'beneficiary.bank_details.account_type',
  'beneficiary.bank_details.bank_account_type',
  'beneficiary.bank_details.swift_code',
  'beneficiary.bank_details.bic',
  'beneficiary.bank_details.bic_code',
  'beneficiary.bank_details.bank_name',
  'beneficiary.bank_details.financial_institution_name',
  'beneficiary.bank_details.bank_street_address',
  'beneficiary.bank_details.bank_address',
  'beneficiary.bank_details.bank_address_line_1',
  'beneficiary.bank_details.bank_country_code',
  'beneficiary.bank_details.bank_country',
  'beneficiary.bank_details.country_code',
  'beneficiary.bank_details.bank_state',
  'beneficiary.bank_details.bank_province',
  'beneficiary.bank_details.bank_city',
  'beneficiary.bank_details.bank_postcode',
  'beneficiary.bank_details.bank_postal_code',
  'beneficiary.bank_details.bank_zip_code',
  'beneficiary.bank_details.intermediary_bank_country_code',
  'beneficiary.bank_details.intermediary_bank_country',
  'beneficiary.bank_details.intermediary_bank_swift_code',
  'beneficiary.bank_details.intermediary_bank_code',
  'beneficiary.bank_details.intermediary_bank_bic',
  'beneficiary.additional_info.transfer_remarks',
  'beneficiary.additional_info.transfer_note',
  'beneficiary.additional_info.payment_reference',
  'beneficiary.bank_details.account_routing_type1',
  'beneficiary.bank_details.routing_code_type',
  'beneficiary.bank_details.primary_routing_code_type',
  'beneficiary.bank_details.account_routing_value2',
  'beneficiary.bank_details.branch_code',
  'beneficiary.bank_details.bank_branch',
  'beneficiary.additional_info.personal_id_type',
  'beneficiary.additional_info.id_document_type',
  'beneficiary.additional_info.personal_id_document_type',
  'beneficiary.additional_info.personal_id_number',
  'beneficiary.additional_info.id_number',
  'beneficiary.additional_info.personal_identification_number',
  'beneficiary.additional_info.business_registration_number',
  'beneficiary.additional_info.company_registration_number',
  'beneficiary.business_registration_number',
]);

const SCENARIO_FIELD_LABELS: Record<string, { label: string; alias: string; example: string }> = {
  'beneficiary.entity_type': { label: '收款人类型', alias: 'Beneficiary Type', example: 'PERSONAL' },
  'beneficiary.bank_details.bank_country_code': { label: '收款国家 / 地区', alias: "Beneficiary's Bank Country/Region", example: 'US' },
  'beneficiary.bank_details.account_currency': { label: '收款币种', alias: 'Currency', example: 'USD' },
  transfer_method: { label: '付款方式', alias: 'Payment Method', example: 'LOCAL' },
  [AIRWALLEX_LOCAL_CLEARING_SYSTEM_PATH]: { label: '本地清算方式', alias: 'local_clearing_system', example: 'ACH' },
};

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="creator-payment-section">
      <header className="creator-payment-section-head">
        <span>{icon}</span>
        <div><h3>{title}</h3><p>{description}</p></div>
      </header>
      {children}
    </section>
  );
}

function FieldLabel({
  label,
  alias,
  required = false,
}: {
  label: string;
  alias: string;
  required?: boolean;
}) {
  return (
    <span className="creator-payment-field-label">
      <span>{label}{required ? <em className="required-mark" aria-hidden="true">*</em> : null}</span>
      <small>{alias}</small>
    </span>
  );
}

function TextField({
  label,
  alias,
  value,
  onChange,
  placeholder,
  required,
  fullWidth,
  type = 'text',
  example,
  issue,
  fieldPath,
}: {
  label: string;
  alias: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  fullWidth?: boolean;
  type?: 'text' | 'email' | 'tel' | 'number';
  example?: string;
  issue?: string;
  fieldPath?: string;
}) {
  return (
    <label
      className={`${fullWidth ? 'full-width' : ''} ${issue ? 'schema-field-control-error' : ''}`}
      data-airwallex-field-path={fieldPath}
    >
      <FieldLabel label={label} alias={alias} required={required} />
      <input
        aria-label={label}
        type={type}
        value={value}
        aria-invalid={issue ? true : undefined}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {issue ? <small className="creator-payment-field-error">{issue}</small> : null}
      {example ? <small className="creator-payment-field-example">示例：{example}</small> : null}
    </label>
  );
}

function SelectFormField<T extends string>({
  label,
  alias,
  value,
  options,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  alias: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; description?: string }>;
  onChange: (value: T) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="form-control">
      <FieldLabel label={label} alias={alias} required={required} />
      <SelectField
        ariaLabel={label}
        variant="form"
        value={value}
        options={options}
        placeholder={placeholder}
        onChange={onChange}
      />
    </div>
  );
}

function SchemaFieldControl({
  item,
  account,
  issue,
  onChange,
}: {
  item: AirwallexFormSchemaField;
  account: AirwallexPayoutAccount;
  issue?: string;
  onChange: (value: string) => void;
}) {
  const { field } = item;
  const documentFieldLabel = DOCUMENT_PAYOUT_FIELD_LABELS[item.path];
  const scenarioFieldLabel = SCENARIO_FIELD_LABELS[item.path];
  const label = {
    'beneficiary.address.country_code': '收款人所在国家 / 地区',
  }[item.path] ?? scenarioFieldLabel?.label ?? documentFieldLabel?.label ?? field.label;
  const alias = scenarioFieldLabel?.alias
    ?? (documentFieldLabel ? `${documentFieldLabel.alias} · ${item.path}` : item.path);
  const value = getAirwallexFormValue(account, item.path) || field.default;
  const options = item.path === AIRWALLEX_LOCAL_CLEARING_SYSTEM_PATH
    ? prioritizeAirwallexLocalClearingOptions(
      account.bankDetails.bankCountryCode,
      field.options ?? [],
    )
    : field.options ?? [];
  const isChoice = field.type === 'RADIO' || field.type === 'TRANSFER_METHOD';
  const isSelect = field.type === 'SELECT';
  const isDynamic = field.type === 'DYNAMIC_SELECT';
  const isFullWidth = (
    item.path === 'beneficiary.company_name'
    || item.path.includes('street_address')
    || field.type === 'TRANSFER_METHOD'
  );
  const inputType = field.key === 'personal_email'
    ? 'email'
    : field.key === 'date_of_birth'
      ? 'date'
      : 'text';
  const example = scenarioFieldLabel?.example || documentFieldLabel?.example || field.example || value || '按 Airwallex Form Schema 填写';
  const help = field.description || field.tip;

  return (
    <div
      className={`schema-field-control ${isFullWidth ? 'full-width' : ''} ${issue ? 'schema-field-control-error' : ''}`}
      data-airwallex-field-path={item.path}
      aria-invalid={issue ? true : undefined}
    >
      <FieldLabel label={label} alias={alias} required={item.required} />
      {isChoice ? (
        <div className={`schema-choice-group ${field.type === 'TRANSFER_METHOD' ? 'schema-choice-group-wide' : ''}`} role="radiogroup" aria-label={label}>
          {options.map((option) => (
            <button
              className={value === option.value ? 'schema-choice-active' : ''}
              type="button"
              role="radio"
              aria-invalid={issue ? true : undefined}
              aria-checked={value === option.value}
              key={option.value}
              onClick={() => onChange(option.value)}
            >
              <span>{option.label}</span>
              {option.description ? <small>{option.description}</small> : null}
            </button>
          ))}
        </div>
      ) : isSelect ? (
        <SelectField
          ariaLabel={label}
          variant="form"
          value={value}
          options={options}
          placeholder={field.placeholder || `选择${label}`}
          menuStrategy={item.path === AIRWALLEX_LOCAL_CLEARING_SYSTEM_PATH ? 'fixed' : 'absolute'}
          onChange={onChange}
        />
      ) : isDynamic && field.dynamic_options ? (
        <DynamicSchemaSelect
          account={account}
          field={item}
          label={label}
          value={value}
          invalid={Boolean(issue)}
          onChange={onChange}
        />
      ) : (
        <div className={isDynamic ? 'schema-dynamic-input' : undefined}>
          {isDynamic ? <Search size={15} aria-hidden="true" /> : null}
          <input
            aria-label={label}
            aria-invalid={issue ? true : undefined}
            type={inputType}
            value={value}
            placeholder={field.placeholder || (field.example ? `例如：${field.example}` : `请输入${label}`)}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      )}
      <div className={`schema-field-help ${issue ? 'schema-field-help-error' : ''}`}>
        {field.refresh ? <em><RefreshCw size={10} />变更后刷新 Schema</em> : null}
        {isDynamic ? <em><Search size={10} />动态银行搜索</em> : null}
        {help ? <span>{help}</span> : null}
        {issue ? <span>{issue}</span> : null}
        <span className="schema-field-example-after-error">示例：{example}</span>
      </div>
    </div>
  );
}

function DynamicSchemaSelect({
  account,
  field,
  label,
  value,
  invalid = false,
  onChange,
}: {
  account: AirwallexPayoutAccount;
  field: AirwallexFormSchemaField;
  label: string;
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [options, setOptions] = useState<AirwallexFormSchemaOption[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [editingQuery, setEditingQuery] = useState(false);

  useEffect(() => {
    if (!editingQuery) setQuery(value);
  }, [editingQuery, value]);

  useEffect(() => {
    const keyword = query.trim();
    if (keyword === value || keyword.length < 3) {
      setOptions([]);
      setStatus('idle');
      setError('');
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStatus('loading');
      setError('');
      getAirwallexDynamicOptions(account, field, keyword, fetch, controller.signal)
        .then((nextOptions) => {
          setOptions(nextOptions);
          setStatus('ready');
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setOptions([]);
          setStatus('error');
          setError(reason instanceof Error ? reason.message : '银行候选加载失败');
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [account, field, query, value]);

  const showResults = status !== 'idle';
  return (
    <div className="schema-dynamic-select">
      <div className="schema-dynamic-input">
        {status === 'loading'
          ? <LoaderCircle className="airwallex-schema-spinner" size={15} aria-hidden="true" />
          : <Search size={15} aria-hidden="true" />}
        <input
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-invalid={invalid ? true : undefined}
          role="combobox"
          value={query}
          placeholder={field.field.placeholder || (field.field.example ? `例如：${field.field.example}` : `搜索${label}`)}
          onChange={(event) => {
            setEditingQuery(true);
            setQuery(event.target.value);
            if (value) onChange('');
          }}
        />
      </div>
      {showResults ? (
        <div className="schema-dynamic-results" role="listbox" aria-label={`${label}候选`}>
          {status === 'loading' ? <span>正在查询 Airwallex 支持的银行…</span> : null}
          {status === 'error' ? <span className="schema-dynamic-error">{error}</span> : null}
          {status === 'ready' && options.length === 0 ? <span>没有匹配的官方候选</span> : null}
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setEditingQuery(false);
                onChange(option.value);
                setQuery(option.value);
                setOptions([]);
                setStatus('idle');
              }}
            >
              <strong>{option.label}</strong>
              {option.description ? <small>{option.description}</small> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DetailGrid({
  items,
}: {
  items: Array<{ label: string; alias: string; value: string; wide?: boolean }>;
}) {
  return (
    <div className="creator-payment-grid">
      {items.map((item) => {
        const value = item.value;
        return (
          <div className={`creator-payment-value ${item.wide ? 'creator-payment-value-wide' : ''}`} key={`${item.alias}-${item.label}`}>
            <span>{item.label}<small>{item.alias}</small></span>
            <strong className={value ? '' : 'creator-payment-empty'}>{value || '待补充'}</strong>
          </div>
        );
      })}
    </div>
  );
}

function StatusPanel({ account }: { account: CreatorPayoutAccount }) {
  const status = getPayoutAccountStatusMeta(account.status, account.provider);
  const icon = status.tone === 'success'
    ? <CheckCircle2 size={18} />
    : status.tone === 'danger'
      ? <AlertCircle size={18} />
      : <ShieldCheck size={18} />;
  return (
    <div className={`payout-account-status-panel payout-account-status-${status.tone}`}>
      {icon}
      <span><strong>{status.label}</strong><small>{status.description}</small></span>
      {account.provider === 'Airwallex' ? (
        <code>{account.beneficiaryId || 'beneficiary_id 待生成'}</code>
      ) : null}
    </div>
  );
}

function AirwallexAccountForm({
  account,
  onChange,
  validationAttempt = 0,
  focusValidationError = true,
}: {
  account: AirwallexPayoutAccount;
  onChange: (account: AirwallexPayoutAccount) => void;
  validationAttempt?: number;
  focusValidationError?: boolean;
}) {
  const fallbackSchema = useMemo(() => generateLocalAirwallexFormSchema(account), [account]);
  const [schema, setSchema] = useState(fallbackSchema);
  const [schemaStatus, setSchemaStatus] = useState<'loading' | 'remote' | 'mock' | 'fallback'>('loading');
  const [schemaError, setSchemaError] = useState('');
  const [beneficiaryStatus, setBeneficiaryStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [beneficiaryError, setBeneficiaryError] = useState('');
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const conditionKey = getAirwallexSchemaConditionKey(account);
  const issues = useMemo(() => validateAirwallexFormSchema(account, schema), [account, schema]);
  const accountIssues = useMemo(() => (
    account.nickname.trim()
      ? issues
      : [{ path: 'nickname', code: 'REQUIRED' as const, message: '账户别名为必填项' }, ...issues]
  ), [account.nickname, issues]);
  const issuesByPath = useMemo(
    () => new Map(accountIssues.map((issue) => [issue.path, issue.message])),
    [accountIssues],
  );
  const enabledFields = schema.fields.filter((item) => item.enabled && item.path !== 'nickname');
  const scenarioFields = enabledFields.filter(
    (item) => getAirwallexSchemaGroup(item.path) === 'condition',
  );
  const paymentFields = enabledFields.filter(
    (item) => getAirwallexSchemaGroup(item.path) !== 'condition'
      && (item.required || REQUESTED_PAYMENT_FIELD_PATHS.has(item.path)),
  );
  const displayedFields = [...scenarioFields, ...paymentFields];
  const requiredFields = displayedFields.filter((item) => item.required);
  const requiredPaymentFields = paymentFields.filter((item) => item.required);
  const supplementalFields = useMemo(
    () => getAirwallexUsPaymentSupplementalFields(schema),
    [schema],
  );

  const focusFirstIssue = () => {
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(
        '.creator-profile-editor-modal [data-airwallex-field-path][aria-invalid="true"], '
        + '.creator-profile-editor-modal [data-airwallex-field-path] [aria-invalid="true"]',
      );
      const focusable = target?.matches('input, button, [tabindex]')
        ? target
        : target?.querySelector<HTMLElement>('input, button, [tabindex]');
      const scroller = target?.closest<HTMLElement>('.modal-content');
      if (target && scroller) {
        const targetRect = target.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        scroller.scrollTo({
          top: Math.max(0, scroller.scrollTop + targetRect.top - scrollerRect.top - 92),
          behavior: 'smooth',
        });
      } else {
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      window.requestAnimationFrame(() => focusable?.focus({ preventScroll: true }));
    });
  };

  useEffect(() => {
    if (validationAttempt <= 0) return;
    setShowValidationErrors(true);
    if (focusValidationError && accountIssues.length) focusFirstIssue();
  }, [validationAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    setSchema(fallbackSchema);
    setSchemaStatus('loading');
    setSchemaError('');
    getAirwallexBeneficiaryFormSchema(account, fetch, controller.signal)
      .then((remoteSchema) => {
        const withDefaults = applyAirwallexSchemaDefaults(account, remoteSchema);
        setSchema(remoteSchema);
        setSchemaStatus(remoteSchema.meta?.simulated ? 'mock' : 'remote');
        if (JSON.stringify(withDefaults) !== JSON.stringify(account)) {
          onChange(invalidateAirwallexVerification(withDefaults));
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSchema(fallbackSchema);
        setSchemaStatus('fallback');
        setSchemaError(error instanceof Error ? error.message : 'Airwallex Form Schema 暂时不可用');
      });
    return () => controller.abort();
  }, [conditionKey]);

  const commit = (next: AirwallexPayoutAccount) => (
    onChange(invalidateAirwallexVerification(next))
  );

  const updateSchemaField = (item: AirwallexFormSchemaField, value: string) => {
    let next = setAirwallexFormValue(account, item.path, value);
    if (item.field.refresh) {
      next = applyAirwallexSchemaDefaults(
        next,
        generateLocalAirwallexFormSchema(next),
      );
    }
    commit(next);
  };

  const renderFields = (fields: AirwallexFormSchemaField[]) => (
    fields.map((item) => (
      <SchemaFieldControl
        item={item}
        account={account}
        issue={showValidationErrors ? issuesByPath.get(item.path) : undefined}
        onChange={(value) => updateSchemaField(item, value)}
        key={item.path}
      />
    ))
  );

  const saveBeneficiary = async () => {
    setShowValidationErrors(true);
    if (accountIssues.length) {
      setBeneficiaryStatus('error');
      setBeneficiaryError(`请先补充 ${accountIssues.length} 项账户信息，系统已定位到第一个遗漏字段。`);
      focusFirstIssue();
      return;
    }
    setBeneficiaryStatus('saving');
    setBeneficiaryError('');
    try {
      const saved = await synchronizeAirwallexBeneficiary(account);
      onChange(saved);
      setBeneficiaryStatus('saved');
    } catch (error) {
      setBeneficiaryStatus('error');
      setBeneficiaryError(error instanceof Error ? error.message : 'Beneficiary 模拟提交失败');
    }
  };

  return (
    <div className="creator-payment-editor payout-account-form" aria-busy={schemaStatus === 'loading'}>
      <StatusPanel account={account} />
      <div className="dynamic-schema-note">
        {schemaStatus === 'loading'
          ? <LoaderCircle className="airwallex-schema-spinner" size={18} />
          : schemaStatus === 'remote' || schemaStatus === 'mock'
            ? <CloudCog size={18} />
            : <WifiOff size={18} />}
        <span>
          <strong>
            {schemaStatus === 'loading'
              ? '正在获取 Airwallex Form Schema'
              : schemaStatus === 'remote'
                ? 'Airwallex Form Schema 已加载'
                : schemaStatus === 'mock'
                  ? 'Airwallex Form Schema 模拟接口已加载'
                  : 'Airwallex Form Schema 本地回退'}
          </strong>
          <small>
            {account.bankDetails.bankCountryCode || '银行国家'} · {account.bankDetails.accountCurrency || '账户币种'} · {account.entityType} · {account.transferMethod}
            {account.transferMethod === 'LOCAL' && account.bankDetails.localClearingSystem ? ` · ${account.bankDetails.localClearingSystem}` : ''}
          </small>
          <code>{AIRWALLEX_FORM_SCHEMA_API_PATH}</code>
        </span>
        <div className="dynamic-schema-meta">
          <em>API {AIRWALLEX_SCHEMA_API_VERSION}</em>
          <b>{displayedFields.length} 个字段 · {requiredFields.length} 个必填</b>
          <b className={accountIssues.length ? 'dynamic-schema-issues' : 'dynamic-schema-complete'}>
            {accountIssues.length ? `${accountIssues.length} 项待完善` : 'Schema 校验完整'}
          </b>
        </div>
      </div>

      <div className="schema-prototype-note">
        {schemaStatus === 'fallback' ? <WifiOff size={14} /> : <RefreshCw size={14} />}
        <span>
          {schemaStatus === 'remote'
            ? '字段、必填规则和格式校验来自 Airwallex；付款场景变化后会重新获取 Schema。'
            : schemaStatus === 'mock'
              ? '当前由本地 Airwallex 模拟代理返回 Schema，用于联调，不代表真实账户或真实手续费。'
              : schemaStatus === 'loading'
                ? '正在通过 COMETS Pay 代理获取付款场景字段，请稍候。'
                : `${schemaError}。当前使用本地同结构 Schema，不会伪造 Airwallex 校验或 beneficiary_id。`}
        </span>
        <code title={conditionKey}>condition {conditionKey}</code>
      </div>

      <Section icon={<Landmark size={19} />} title="账户配置" description="COMETS Pay 内部账户名称，不作为 Airwallex 银行资料字段">
        <div className="form-grid creator-payment-form-grid">
          <TextField
            label="账户别名"
            alias="Internal nickname"
            value={account.nickname}
            onChange={(value) => commit({ ...account, nickname: value })}
            placeholder="例如：美国 USD 主账户"
            example="美国 USD 主账户"
            issue={showValidationErrors ? issuesByPath.get('nickname') : undefined}
            fieldPath="nickname"
            required
          />
        </div>
      </Section>

      <Section icon={<CircleDollarSign size={19} />} title="付款场景" description="国家、收款人类型、币种、转账方式和本地清算方式共同决定 Airwallex 必填字段">
        <div className="airwallex-card-context">
          <span>
            <strong>{account.transferMethod === 'LOCAL' ? '本地银行转账' : '国际电汇'}</strong>
            <small>{account.transferMethod === 'LOCAL' ? '低费清算网络优先展示；实际手续费以付款报价为准' : 'SWIFT 路径不使用本地清算方式'}</small>
          </span>
          <em>{scenarioFields.length} 项场景参数</em>
        </div>
        <div className="form-grid creator-payment-form-grid">
          {renderFields(scenarioFields)}
        </div>
      </Section>

      <Section icon={<ShieldCheck size={19} />} title="Airwallex 付款信息" description="需要填写的付款信息字段由 Airwallex Form Schema 决定，当前使用模拟美国付款场景展示">
        <div className="airwallex-card-context">
          <span>
            <strong>Paid by Bank</strong>
            <small>主体、地址和银行字段随付款场景动态变化</small>
          </span>
          <em>{requiredPaymentFields.length} 项必填 · {paymentFields.length} 项字段</em>
        </div>
        <div className="form-grid creator-payment-form-grid">
          {renderFields(paymentFields)}
        </div>
      </Section>

      {supplementalFields.length ? (
        <Section icon={<Plus size={19} />} title="补充付款信息" description="补充模拟美国付款展示中未由当前 Airwallex Form Schema 返回的字段，均提供填写示例">
          <div className="form-grid creator-payment-form-grid airwallex-supplemental-grid">
            {supplementalFields.map((field) => {
              const display = DOCUMENT_PAYOUT_FIELD_LABELS[field.path];
              return (
                <TextField
                  label={display?.label ?? field.sourceLabel}
                  alias={`${(display?.alias ?? field.label).replace(/\s*·\s*选填$/, '')} · 选填`}
                  value={getAirwallexFormValue(account, field.path)}
                  onChange={(value) => commit(setAirwallexFormValue(account, field.path, value))}
                  placeholder={field.placeholder}
                  example={display?.example ?? field.placeholder.replace(/^例如：/, '')}
                  type={field.type}
                  fullWidth={field.key.includes('address') || field.key === 'transfer_remarks'}
                  key={field.key}
                />
              );
            })}
          </div>
        </Section>
      ) : null}
      <div className="airwallex-beneficiary-actions">
        <span>
          <strong>{account.beneficiaryId ? '重新校验账户' : '校验账户后创建档案'}</strong>
          <small>
            {beneficiaryStatus === 'saved'
              ? '账户资料已校验，可继续创建达人档案'
              : '先按当前 Airwallex Form Schema 校验账户，校验完成后才可创建达人档案'}
          </small>
        </span>
        <Button
          icon={beneficiaryStatus === 'saving' ? <LoaderCircle className="airwallex-schema-spinner" size={16} /> : <ShieldCheck size={16} />}
          disabled={beneficiaryStatus === 'saving'}
          disabledReason="收款账户正在保存，请稍候。"
          onClick={saveBeneficiary}
        >
          {beneficiaryStatus === 'saving' ? '正在校验账户' : '校验账户'}
        </Button>
      </div>
      {beneficiaryStatus === 'saved' ? (
        <div className="airwallex-beneficiary-success" role="status">
          <CheckCircle2 size={16} />
          <span>校验通过，已回写 {account.beneficiaryId || 'beneficiary_id'}</span>
        </div>
      ) : null}
      {beneficiaryError ? <div className="inline-alert"><AlertCircle size={16} />{beneficiaryError}</div> : null}
    </div>
  );
}

function PayPalAccountForm({
  account,
  onChange,
}: {
  account: PayPalPayoutAccount;
  onChange: (account: PayPalPayoutAccount) => void;
}) {
  const commit = (next: PayPalPayoutAccount) => onChange(normalizePayPalStatus(next));
  return (
    <div className="creator-payment-editor payout-account-form">
      <StatusPanel account={account} />
      <Section icon={<Wallet size={19} />} title="PayPal 账户" description="PayPal 与 Airwallex 银行字段独立维护">
        <div className="form-grid creator-payment-form-grid">
          <TextField label="账户别名" alias="Internal nickname" value={account.nickname} onChange={(value) => onChange({ ...account, nickname: value })} placeholder="例如：主 PayPal 账户" required />
          <TextField label="PayPal Username" alias="PayPal 用户名 · paypalUsername" value={account.paypalUsername} onChange={(value) => commit({ ...account, paypalUsername: value })} placeholder="账户显示名称" required />
          <TextField label="PayPal Email Address" alias="PayPal 邮箱 · paypalEmail" value={account.paypalEmail} onChange={(value) => commit({ ...account, paypalEmail: value })} placeholder="收款邮箱" type="email" required />
          <TextField label="Transfer Note" alias="转账备注 · transferNote · 选填" value={account.transferNote ?? ''} onChange={(value) => commit({ ...account, transferNote: value })} placeholder="写入 PayPal item note" />
        </div>
      </Section>
    </div>
  );
}

function PayMaxAccountForm({
  account,
  onChange,
}: {
  account: PayMaxPayoutAccount;
  onChange: (account: PayMaxPayoutAccount) => void;
}) {
  const commit = (next: PayMaxPayoutAccount) => onChange(normalizePayMaxStatus(next));
  const countryOptions = AIRWALLEX_COUNTRIES.map((country) => ({
    value: country.value,
    label: `${country.label} · ${country.value}`,
  }));
  const currencyOptions = AIRWALLEX_CURRENCIES.map((currency) => ({
    value: currency,
    label: currency,
  }));

  return (
    <div className="creator-payment-editor payout-account-form">
      <StatusPanel account={account} />
      <Section icon={<CircleDollarSign size={19} />} title="Payer Max 账户" description="Payer Max 收款账号与 Airwallex、PayPal 资料独立维护">
        <div className="form-grid creator-payment-form-grid">
          <TextField label="账户别名" alias="Internal nickname" value={account.nickname} onChange={(value) => onChange({ ...account, nickname: value })} placeholder="例如：Payer Max 主账户" required />
          <TextField label="收款人名称" alias="beneficiaryName" value={account.beneficiaryName} onChange={(value) => commit({ ...account, beneficiaryName: value })} placeholder="个人姓名或公司法定名称" required />
          <TextField label="Payer Max 收款账号" alias="payermaxAccountId" value={account.payermaxAccountId} onChange={(value) => commit({ ...account, payermaxAccountId: value })} placeholder="Payer Max 返回的收款账号" required />
          <TextField label="联系邮箱" alias="email · 选填" value={account.email} onChange={(value) => commit({ ...account, email: value })} placeholder="creator@example.com" type="email" />
          <SelectFormField
            label="收款国家 / 地区"
            alias="countryCode"
            value={account.countryCode}
            options={countryOptions}
            placeholder="选择国家 / 地区"
            onChange={(value) => commit({ ...account, countryCode: value })}
            required
          />
          <SelectFormField
            label="收款币种"
            alias="currency"
            value={account.currency}
            options={currencyOptions}
            placeholder="选择币种"
            onChange={(value) => commit({ ...account, currency: value })}
            required
          />
        </div>
      </Section>
    </div>
  );
}

function AirwallexAccountView({ account }: { account: AirwallexPayoutAccount }) {
  const entityName = account.entityType === 'COMPANY'
    ? account.companyName
    : [account.firstName, account.lastName].filter(Boolean).join(' ');
  const address = [
    account.address.streetAddress,
    account.address.city,
    account.address.state,
    account.address.postcode,
    account.address.countryCode,
  ].filter(Boolean).join(', ');
  const routing = [
    account.bankDetails.accountRoutingType1 && `${account.bankDetails.accountRoutingType1}: ${account.bankDetails.accountRoutingValue1 || '待补充'}`,
    account.bankDetails.accountRoutingType2 && `${account.bankDetails.accountRoutingType2}: ${account.bankDetails.accountRoutingValue2 || '待补充'}`,
  ].filter(Boolean).join(' · ');
  const structuredBankAddress = [
    account.bankDetails.bankStreetAddress,
    getAirwallexFormValue(account, 'beneficiary.bank_details.bank_city'),
    account.bankDetails.bankState,
    getAirwallexFormValue(account, 'beneficiary.bank_details.bank_postcode'),
  ].filter(Boolean).join(', ');
  const bankAddress = structuredBankAddress
    || getAirwallexFormValue(account, 'profile_supplement.beneficiary_bank_address');
  return (
    <div className="creator-profile-content payout-account-view">
      <StatusPanel account={account} />
      <Section icon={<ShieldCheck size={19} />} title="收款主体" description="Airwallex Beneficiary 身份和结构化地址">
        <DetailGrid items={[
          { label: '主体类型', alias: 'entity_type', value: account.entityType },
          { label: '法定名称 / Real Name', alias: account.entityType === 'COMPANY' ? 'company_name' : 'first_name / last_name', value: entityName },
          { label: '通知邮箱', alias: 'additional_info.personal_email', value: account.notificationEmail },
          { label: '收款人地址', alias: 'beneficiary.address', value: address, wide: true },
        ]} />
      </Section>
      <Section icon={<CircleDollarSign size={19} />} title="付款场景" description="用于获取 Airwallex 动态 Form Schema">
        <DetailGrid items={[
          { label: '银行国家', alias: 'bank_country_code', value: `${account.bankDetails.bankCountryName} · ${account.bankDetails.bankCountryCode}` },
          { label: '账户币种', alias: 'account_currency', value: account.bankDetails.accountCurrency },
          { label: '转账方式', alias: 'transfer_method', value: account.transferMethod },
          { label: '本地清算方式', alias: 'local_clearing_system', value: account.transferMethod === 'LOCAL' ? account.bankDetails.localClearingSystem : '不适用' },
        ]} />
      </Section>
      <Section icon={<Landmark size={19} />} title="Airwallex 付款信息" description="完整展示当前账户资料；字段是否必填由当前 Form Schema 决定">
        <DetailGrid items={[
          { label: 'Account Name', alias: '账户名称 · account_name', value: account.bankDetails.accountName },
          { label: '账户类型', alias: 'bank_account_category', value: account.bankDetails.bankAccountCategory },
          { label: 'Account Number', alias: '银行账号 · account_number', value: account.bankDetails.accountNumber },
          { label: 'IBAN', alias: '国际银行账号 · iban', value: account.bankDetails.iban },
          { label: '本地路由', alias: 'account_routing_type / value', value: routing, wide: true },
          { label: 'Beneficiary Bank Name', alias: '收款银行名称 · bank_name', value: account.bankDetails.bankName },
          { label: 'Beneficiary Bank Address', alias: '收款银行地址', value: bankAddress, wide: true },
          { label: '分行名称', alias: 'bank_branch', value: account.bankDetails.bankBranch },
          { label: 'SWIFT Code', alias: 'SWIFT / BIC · swift_code', value: account.bankDetails.swiftCode },
          { label: '中间行', alias: 'intermediary_bank_name / swift_code', value: [account.bankDetails.intermediaryBankName, account.bankDetails.intermediaryBankSwiftCode].filter(Boolean).join(' · '), wide: true },
        ]} />
      </Section>
      <Section icon={<CheckCircle2 size={19} />} title="验证结果" description="接入后由 Validate 与 Verify Account API 回写">
        <DetailGrid items={[
          { label: '账户验证结果', alias: 'verificationCode', value: account.verificationCode || '尚未执行' },
          { label: '账户名匹配', alias: 'nameMatchResult', value: account.nameMatchResult || '尚未执行' },
          { label: '最近校验时间', alias: 'validatedAt', value: account.validatedAt },
          { label: '最近验证时间', alias: 'verifiedAt', value: account.verifiedAt },
        ]} />
      </Section>
    </div>
  );
}

function PayPalAccountView({ account }: { account: PayPalPayoutAccount }) {
  return (
    <div className="creator-profile-content payout-account-view">
      <StatusPanel account={account} />
      <Section icon={<Wallet size={19} />} title="PayPal 账户" description="与 Airwallex 银行收款账户独立维护">
        <DetailGrid items={[
          { label: '账户别名', alias: 'nickname', value: account.nickname },
          { label: 'PayPal Username', alias: 'PayPal 用户名 · paypalUsername', value: account.paypalUsername },
          { label: 'PayPal Email Address', alias: 'PayPal 邮箱 · paypalEmail', value: account.paypalEmail, wide: true },
          { label: 'Transfer Note', alias: '转账备注 · transferNote · 选填', value: account.transferNote ?? '', wide: true },
        ]} />
      </Section>
    </div>
  );
}

function PayMaxAccountView({ account }: { account: PayMaxPayoutAccount }) {
  return (
    <div className="creator-profile-content payout-account-view">
      <StatusPanel account={account} />
      <Section icon={<CircleDollarSign size={19} />} title="Payer Max 账户" description="与 Airwallex 和 PayPal 收款账户独立维护">
        <DetailGrid items={[
          { label: '账户别名', alias: 'nickname', value: account.nickname },
          { label: '收款人名称', alias: 'beneficiaryName', value: account.beneficiaryName },
          { label: 'Payer Max 收款账号', alias: 'payermaxAccountId', value: account.payermaxAccountId },
          { label: '国家 / 地区', alias: 'countryCode', value: account.countryCode },
          { label: '收款币种', alias: 'currency', value: account.currency },
          { label: '联系邮箱', alias: 'email', value: account.email },
        ]} />
      </Section>
    </div>
  );
}

type PayoutProvider = CreatorPayoutAccount['provider'];

const PAYOUT_PROVIDERS: Array<{
  value: PayoutProvider;
  label: string;
  icon: typeof Landmark;
  available: boolean;
}> = [
  { value: 'Airwallex', label: 'Airwallex', icon: Landmark, available: true },
  { value: 'PayPal', label: 'PayPal', icon: Wallet, available: false },
  { value: 'PayMax', label: 'Payer Max', icon: CircleDollarSign, available: false },
];

export function CreatorPayoutAccounts({
  accounts,
  editing = false,
  creatorId,
  creatorName,
  creatorEmail,
  validationAttempt = 0,
  focusValidationError = true,
  onChange,
}: CreatorPayoutAccountsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const defaultAccount = useMemo(() => getDefaultPayoutAccount(accounts), [accounts]);
  const [activeProvider, setActiveProvider] = useState<PayoutProvider>(
    defaultAccount?.provider ?? 'Airwallex',
  );
  const [selectedId, setSelectedId] = useState(defaultAccount?.id ?? '');
  const [openMenuId, setOpenMenuId] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState('');
  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.provider === activeProvider),
    [accounts, activeProvider],
  );
  const selectedAccount = (
    activeAccounts.find((account) => account.id === selectedId)
    ?? activeAccounts.find((account) => account.isDefault)
    ?? activeAccounts[0]
    ?? null
  );
  const deleteTarget = accounts.find((account) => account.id === deleteTargetId) ?? null;
  const usableAccountCount = accounts.filter(isPayoutAccountVerified).length;
  const activeProviderConfig = (
    PAYOUT_PROVIDERS.find((provider) => provider.value === activeProvider)
    ?? PAYOUT_PROVIDERS[0]
  );
  const ActiveProviderIcon = activeProviderConfig.icon;

  useEffect(() => {
    if (selectedAccount?.id === selectedId) return;
    setSelectedId(selectedAccount?.id ?? '');
  }, [selectedAccount?.id, selectedId]);

  const replaceAccount = (updated: CreatorPayoutAccount) => {
    onChange?.(accounts.map((account) => account.id === updated.id ? updated : account));
  };

  const addAccount = (provider: PayoutProvider) => {
    if (provider !== 'Airwallex') return;
    const next = createEmptyAirwallexAccount(creatorName, creatorEmail, creatorId);
    const normalized = { ...next, isDefault: getDefaultPayoutAccount(accounts) === null };
    onChange?.([...accounts, normalized]);
    setActiveProvider(provider);
    setSelectedId(normalized.id);
    setOpenMenuId('');
  };

  const setDefault = (target: CreatorPayoutAccount) => {
    onChange?.(accounts.map((account) => ({ ...account, isDefault: account.id === target.id })));
    setOpenMenuId('');
  };

  const editAccount = (target: CreatorPayoutAccount) => {
    setSelectedId(target.id);
    setOpenMenuId('');
    window.requestAnimationFrame(() => {
      const form = rootRef.current?.querySelector<HTMLElement>('.payout-account-form');
      form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.requestAnimationFrame(() => {
        form?.querySelector<HTMLInputElement>('[aria-label="账户别名"]')?.focus({ preventScroll: true });
      });
    });
  };

  const requestDeleteAccount = (target: CreatorPayoutAccount) => {
    if (!canDeletePayoutAccount(target)) return;
    setDeleteTargetId(target.id);
    setOpenMenuId('');
  };

  const confirmDeleteAccount = () => {
    if (!deleteTarget) return;
    const nextAccounts = deletePayoutAccount(accounts, deleteTarget.id);
    if (nextAccounts === accounts) {
      setDeleteTargetId('');
      return;
    }

    onChange?.(nextAccounts);
    const nextSelected = nextAccounts.find((account) => (
      account.provider === activeProvider && account.id !== deleteTarget.id
    )) ?? null;
    setSelectedId(nextSelected?.id ?? '');
    setDeleteTargetId('');
  };

  return (
    <div className="payout-accounts" ref={rootRef}>
      <div className="payout-account-availability" aria-label={`${usableAccountCount} 个可用收款账户`}>
        <Circle size={6} fill="currentColor" aria-hidden="true" />
        <strong>{usableAccountCount} 个可用</strong>
      </div>

      <div className="payout-account-overview">
        <div className="payout-provider-tabs" role="tablist" aria-label="收款渠道">
          {PAYOUT_PROVIDERS.map((provider) => {
            const providerAccounts = accounts.filter((account) => account.provider === provider.value);
            const providerUsableCount = providerAccounts.filter(isPayoutAccountVerified).length;
            return (
              <button
                className={`payout-provider-tab ${activeProvider === provider.value ? 'payout-provider-tab-active' : ''} ${!provider.available ? 'payout-provider-tab-disabled' : ''}`}
                type="button"
                role="tab"
                aria-selected={activeProvider === provider.value}
                aria-disabled={!provider.available}
                aria-controls="payout-provider-panel"
                disabled={!provider.available}
                key={provider.value}
                onClick={() => {
                  const nextAccount = (
                    providerAccounts.find((account) => account.isDefault)
                    ?? providerAccounts[0]
                    ?? null
                  );
                  setActiveProvider(provider.value);
                  setSelectedId(nextAccount?.id ?? '');
                  setOpenMenuId('');
                }}
              >
                <strong>{provider.label}</strong>
                <small>
                  {!provider.available
                    ? '暂未开放 · 暂不支持创建'
                    : providerAccounts.length
                    ? `${providerAccounts.length} 个账户 · ${providerUsableCount} 个可用`
                    : '0 个账户 · 暂未开设'}
                </small>
              </button>
            );
          })}
        </div>

        <div className="payout-account-cards" id="payout-provider-panel" role="tabpanel">
          {activeAccounts.map((account) => {
            const status = getPayoutAccountStatusMeta(account.status, account.provider);
            const provider = PAYOUT_PROVIDERS.find((item) => item.value === account.provider);
            const ProviderIcon = provider?.icon ?? Landmark;
            const deletable = canDeletePayoutAccount(account);
            const deleteBlockedReason = account.activePaymentId
              ? '该账户存在进行中的付款，暂不能删除'
              : '该账户已验证或存在历史业务关联，为保护合同、Invoice 和付款快照，不能直接删除';
            return (
              <article
                className={`payout-account-card ${selectedAccount?.id === account.id ? 'payout-account-card-active' : ''}`}
                key={account.id}
              >
                <button
                  className="payout-account-card-main"
                  type="button"
                  aria-pressed={selectedAccount?.id === account.id}
                  onClick={() => {
                    setSelectedId(account.id);
                    setOpenMenuId('');
                  }}
                >
                  <span className="payout-account-card-icon"><ProviderIcon size={18} /></span>
                  <span className="payout-account-card-copy">
                    <strong>{account.nickname}</strong>
                    <small>{getPayoutAccountSummary(account)} · {getPayoutAccountIdentifier(account)}</small>
                    <em className={`payout-account-mini-status payout-account-mini-status-${status.tone}`}>
                      <Circle size={5} fill="currentColor" aria-hidden="true" />
                      {status.label}
                    </em>
                  </span>
                </button>
                {account.isDefault ? <Star className="payout-account-default-star" size={15} fill="currentColor" aria-label="默认账户" /> : null}
                {editing ? (
                  <button
                    className="payout-account-card-menu-button"
                    type="button"
                    title="账户操作"
                    aria-label={`${account.nickname}账户操作`}
                    aria-haspopup="menu"
                    aria-expanded={openMenuId === account.id}
                    onClick={() => {
                      setSelectedId(account.id);
                      setOpenMenuId((current) => current === account.id ? '' : account.id);
                    }}
                  >
                    <MoreHorizontal size={17} />
                  </button>
                ) : null}
                {editing && openMenuId === account.id ? (
                  <div className="payout-account-card-menu" role="menu" aria-label={`${account.nickname}账户操作`}>
                    <button type="button" role="menuitem" onClick={() => editAccount(account)}>
                      <Pencil size={14} />
                      编辑账户
                    </button>
                    <button type="button" role="menuitem" disabled={account.isDefault} onClick={() => setDefault(account)}>
                      <Star size={14} />
                      {account.isDefault ? '当前默认账户' : '设为默认账户'}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!deletable}
                      title={deletable ? '删除账户' : deleteBlockedReason}
                      aria-label={deletable ? `删除${account.nickname}` : `无法删除${account.nickname}：${deleteBlockedReason}`}
                      onClick={() => requestDeleteAccount(account)}
                    >
                      <Trash2 size={14} />
                      {deletable ? '删除账户' : '删除账户（不可用）'}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
          {activeAccounts.length === 0 ? (
            <div className="payout-provider-empty">
              <ActiveProviderIcon size={22} />
              <span>
                <strong>尚未开设该渠道账户</strong>
                <small>{activeProviderConfig.available ? '可在下方新建 Airwallex 账户。' : '该渠道暂未开放，暂不支持创建账户。'}</small>
              </span>
            </div>
          ) : null}
        </div>

        {editing ? (
          <div className="payout-account-actions">
            {PAYOUT_PROVIDERS.map((provider) => (
              <Button
                variant="secondary"
                icon={<Plus size={15} />}
                key={provider.value}
                disabled={!provider.available}
                disabledReason={`${provider.label} 暂未开放`}
                title={provider.available ? `新建 ${provider.label} 账户` : `${provider.label} 暂未开放`}
                onClick={() => addAccount(provider.value)}
              >
                {provider.label} 账户{provider.available ? '' : '（暂未开放）'}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {selectedAccount?.provider === 'Airwallex' ? (
        editing
          ? (
            <AirwallexAccountForm
              account={selectedAccount}
              onChange={replaceAccount}
              validationAttempt={validationAttempt}
              focusValidationError={focusValidationError}
            />
          )
          : <AirwallexAccountView account={selectedAccount} />
      ) : selectedAccount?.provider === 'PayPal' ? (
        editing
          ? <PayPalAccountForm account={selectedAccount} onChange={replaceAccount} />
          : <PayPalAccountView account={selectedAccount} />
      ) : selectedAccount?.provider === 'PayMax' ? (
        editing
          ? <PayMaxAccountForm account={selectedAccount} onChange={replaceAccount} />
          : <PayMaxAccountView account={selectedAccount} />
      ) : null}

      {deleteTarget ? (
        <Modal
          title="删除收款账户"
          width="440px"
          className="project-payment-remove-modal"
          onClose={() => setDeleteTargetId('')}
          footer={(
            <>
              <Button variant="secondary" autoFocus onClick={() => setDeleteTargetId('')}>取消</Button>
              <Button variant="danger" onClick={confirmDeleteAccount}>删除账户</Button>
            </>
          )}
        >
          <div className="project-payment-remove-confirmation">
            <span><AlertTriangle size={22} /></span>
            <div>
              <strong>{deleteTarget.nickname}</strong>
              <p>{paymentProviderDisplayName(deleteTarget.provider)} · {getPayoutAccountIdentifier(deleteTarget)}</p>
              <small>删除后，该账户将从当前达人档案中移除。已有历史业务关联的账户不会开放删除，合同、Invoice 和付款快照不受影响。</small>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
