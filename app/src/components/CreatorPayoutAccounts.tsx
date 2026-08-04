import {
  AlertCircle,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  CloudCog,
  Landmark,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Wallet,
  WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AIRWALLEX_COUNTRIES,
  AIRWALLEX_CURRENCIES,
  createEmptyAirwallexAccount,
  createEmptyPayMaxAccount,
  createEmptyPayPalAccount,
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
} from '../airwallexBeneficiaryApi';
import { getAirwallexBankPaymentFallbackFields } from '../airwallexSupplementalFields';
import type {
  AirwallexPayoutAccount,
  CreatorPayoutAccount,
  PayMaxPayoutAccount,
  PayPalPayoutAccount,
} from '../types';
import { Button, SelectField } from './Common';

type CreatorPayoutAccountsProps = {
  accounts: CreatorPayoutAccount[];
  editing?: boolean;
  creatorName: string;
  creatorEmail: string;
  onChange?: (accounts: CreatorPayoutAccount[]) => void;
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
}: {
  label: string;
  alias: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  fullWidth?: boolean;
  type?: 'text' | 'email' | 'tel' | 'number';
}) {
  return (
    <label className={fullWidth ? 'full-width' : ''}>
      <FieldLabel label={label} alias={alias} required={required} />
      <input
        aria-label={label}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
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
  const label = {
    'beneficiary.bank_details.bank_country_code': '收款国家 / 地区',
    'beneficiary.bank_details.account_currency': '收款币种',
    'beneficiary.entity_type': '收款人类型',
    transfer_method: '转账方式',
    [AIRWALLEX_LOCAL_CLEARING_SYSTEM_PATH]: '本地清算方式',
    'beneficiary.address.country_code': '收款人所在国家 / 地区',
  }[item.path] ?? field.label;
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
  const help = issue
    || field.description
    || field.tip
    || (field.example ? `示例：${field.example}` : '');

  return (
    <div className={`schema-field-control ${isFullWidth ? 'full-width' : ''} ${issue ? 'schema-field-control-error' : ''}`}>
      <FieldLabel label={label} alias={item.path} required={item.required} />
      {isChoice ? (
        <div className={`schema-choice-group ${field.type === 'TRANSFER_METHOD' ? 'schema-choice-group-wide' : ''}`} role="radiogroup" aria-label={label}>
          {options.map((option) => (
            <button
              className={value === option.value ? 'schema-choice-active' : ''}
              type="button"
              role="radio"
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
          onChange={onChange}
        />
      ) : isDynamic && field.dynamic_options ? (
        <DynamicSchemaSelect
          account={account}
          field={item}
          label={label}
          value={value}
          onChange={onChange}
        />
      ) : (
        <div className={isDynamic ? 'schema-dynamic-input' : undefined}>
          {isDynamic ? <Search size={15} aria-hidden="true" /> : null}
          <input
            aria-label={label}
            type={inputType}
            value={value}
            placeholder={field.placeholder || (field.example ? `例如：${field.example}` : `请输入${label}`)}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      )}
      {(help || field.refresh || isDynamic) ? (
        <div className={`schema-field-help ${issue ? 'schema-field-help-error' : ''}`}>
          {field.refresh ? <em><RefreshCw size={10} />变更后刷新 Schema</em> : null}
          {isDynamic ? <em><Search size={10} />动态银行搜索</em> : null}
          {help ? <span>{help}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function DynamicSchemaSelect({
  account,
  field,
  label,
  value,
  onChange,
}: {
  account: AirwallexPayoutAccount;
  field: AirwallexFormSchemaField;
  label: string;
  value: string;
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
  items: Array<{ label: string; alias: string; value: string; wide?: boolean; mask?: boolean }>;
}) {
  return (
    <div className="creator-payment-grid">
      {items.map((item) => {
        const normalized = item.value.replace(/\s/g, '');
        const value = item.mask && normalized ? `•••• ${normalized.slice(-4)}` : item.value;
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
}: {
  account: AirwallexPayoutAccount;
  onChange: (account: AirwallexPayoutAccount) => void;
}) {
  const fallbackSchema = useMemo(() => generateLocalAirwallexFormSchema(account), [account]);
  const [schema, setSchema] = useState(fallbackSchema);
  const [schemaStatus, setSchemaStatus] = useState<'loading' | 'remote' | 'mock' | 'fallback'>('loading');
  const [schemaError, setSchemaError] = useState('');
  const conditionKey = getAirwallexSchemaConditionKey(account);
  const issues = useMemo(() => validateAirwallexFormSchema(account, schema), [account, schema]);
  const issuesByPath = useMemo(
    () => new Map(issues.map((issue) => [issue.path, issue.message])),
    [issues],
  );
  const enabledFields = schema.fields.filter((item) => item.enabled && item.path !== 'nickname');
  const requiredFields = schema.fields.filter((item) => item.enabled && item.required);
  const scenarioFields = enabledFields.filter(
    (item) => getAirwallexSchemaGroup(item.path) === 'condition',
  );
  const paymentFields = enabledFields.filter(
    (item) => getAirwallexSchemaGroup(item.path) !== 'condition',
  );
  const requiredPaymentFields = paymentFields.filter((item) => item.required);
  const fallbackFields = useMemo(
    () => getAirwallexBankPaymentFallbackFields(schema),
    [schema],
  );

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
        issue={issuesByPath.get(item.path)}
        onChange={(value) => updateSchemaField(item, value)}
        key={item.path}
      />
    ))
  );

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
          <b>{enabledFields.length} 个字段 · {requiredFields.length} 个必填</b>
          <b className={issues.length ? 'dynamic-schema-issues' : 'dynamic-schema-complete'}>
            {issues.length ? `${issues.length} 项待完善` : 'Schema 校验完整'}
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
          <TextField label="账户别名" alias="Internal nickname" value={account.nickname} onChange={(value) => commit({ ...account, nickname: value })} placeholder="例如：日本 JPY 主账户" required />
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

      <Section icon={<ShieldCheck size={19} />} title="Airwallex 付款信息" description="按当前 Form Schema 展示字段、必填规则和格式校验，付款方式为银行账户">
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
        <div className="airwallex-signature-boundary">
          <span>Signature</span>
          <small>签名区由每份 Invoice 单独保留，不写入收款账户，也不提交 Airwallex。</small>
        </div>
      </Section>

      {fallbackFields.length ? (
        <Section icon={<Plus size={19} />} title="补充付款资料" description="仅补充当前 Schema 未覆盖的 Invoice 银行字段；同义字段不会重复，全部为选填">
          <div className="form-grid creator-payment-form-grid airwallex-supplemental-grid">
            {fallbackFields.map((field) => (
              <TextField
                label={field.label}
                alias={`${field.sourceLabel} · 选填`}
                value={getAirwallexFormValue(account, field.path)}
                onChange={(value) => commit(setAirwallexFormValue(account, field.path, value))}
                placeholder={field.placeholder}
                type={field.type}
                fullWidth={field.key === 'beneficiary_bank_address'}
                key={field.key}
              />
            ))}
          </div>
        </Section>
      ) : null}
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
          <TextField label="PayPal 用户名" alias="paypalUsername" value={account.paypalUsername} onChange={(value) => commit({ ...account, paypalUsername: value })} placeholder="账户显示名称" required />
          <TextField label="PayPal 邮箱" alias="paypalEmail" value={account.paypalEmail} onChange={(value) => commit({ ...account, paypalEmail: value })} placeholder="收款邮箱" type="email" required />
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
      <Section icon={<CircleDollarSign size={19} />} title="PayerMax 账户" description="PayerMax 收款账号与 Airwallex、PayPal 资料独立维护">
        <div className="form-grid creator-payment-form-grid">
          <TextField label="账户别名" alias="Internal nickname" value={account.nickname} onChange={(value) => onChange({ ...account, nickname: value })} placeholder="例如：PayerMax 主账户" required />
          <TextField label="收款人名称" alias="beneficiaryName" value={account.beneficiaryName} onChange={(value) => commit({ ...account, beneficiaryName: value })} placeholder="个人姓名或公司法定名称" required />
          <TextField label="PayerMax 收款账号" alias="payermaxAccountId" value={account.payermaxAccountId} onChange={(value) => commit({ ...account, payermaxAccountId: value })} placeholder="PayerMax 返回的收款账号" required />
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
      <Section icon={<Landmark size={19} />} title="Airwallex 付款信息" description="银行账号默认掩码展示；字段是否必填由当前 Form Schema 决定">
        <DetailGrid items={[
          { label: '账户名称', alias: 'account_name', value: account.bankDetails.accountName },
          { label: '账户类型', alias: 'bank_account_category', value: account.bankDetails.bankAccountCategory },
          { label: '银行账号', alias: 'account_number', value: account.bankDetails.accountNumber, mask: true },
          { label: 'IBAN', alias: 'iban', value: account.bankDetails.iban, mask: true },
          { label: '本地路由', alias: 'account_routing_type / value', value: routing, wide: true },
          { label: '银行名称', alias: 'bank_name', value: account.bankDetails.bankName },
          { label: '收款银行地址', alias: 'Beneficiary Bank Address', value: bankAddress, wide: true },
          { label: '分行名称', alias: 'bank_branch', value: account.bankDetails.bankBranch },
          { label: 'SWIFT / BIC', alias: 'swift_code', value: account.bankDetails.swiftCode },
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
          { label: 'PayPal 用户名', alias: 'paypalUsername', value: account.paypalUsername },
          { label: 'PayPal 邮箱', alias: 'paypalEmail', value: account.paypalEmail, wide: true },
        ]} />
      </Section>
    </div>
  );
}

function PayMaxAccountView({ account }: { account: PayMaxPayoutAccount }) {
  return (
    <div className="creator-profile-content payout-account-view">
      <StatusPanel account={account} />
      <Section icon={<CircleDollarSign size={19} />} title="PayerMax 账户" description="与 Airwallex 和 PayPal 收款账户独立维护">
        <DetailGrid items={[
          { label: '账户别名', alias: 'nickname', value: account.nickname },
          { label: '收款人名称', alias: 'beneficiaryName', value: account.beneficiaryName },
          { label: 'PayerMax 收款账号', alias: 'payermaxAccountId', value: account.payermaxAccountId, mask: true },
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
}> = [
  { value: 'Airwallex', label: 'Airwallex', icon: Landmark },
  { value: 'PayPal', label: 'PayPal', icon: Wallet },
  { value: 'PayMax', label: 'PayerMax', icon: CircleDollarSign },
];

export function CreatorPayoutAccounts({
  accounts,
  editing = false,
  creatorName,
  creatorEmail,
  onChange,
}: CreatorPayoutAccountsProps) {
  const defaultAccount = useMemo(() => getDefaultPayoutAccount(accounts), [accounts]);
  const [activeProvider, setActiveProvider] = useState<PayoutProvider>(
    defaultAccount?.provider ?? 'Airwallex',
  );
  const [selectedId, setSelectedId] = useState(defaultAccount?.id ?? '');
  const [openMenuId, setOpenMenuId] = useState('');
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
    const next = provider === 'Airwallex'
      ? createEmptyAirwallexAccount(creatorName, creatorEmail)
      : provider === 'PayPal'
        ? createEmptyPayPalAccount(creatorName, creatorEmail)
        : createEmptyPayMaxAccount(creatorName, creatorEmail);
    const normalized = { ...next, isDefault: accounts.length === 0 };
    onChange?.([...accounts, normalized]);
    setActiveProvider(provider);
    setSelectedId(normalized.id);
    setOpenMenuId('');
  };

  const setDefault = (target: CreatorPayoutAccount) => {
    onChange?.(accounts.map((account) => ({ ...account, isDefault: account.id === target.id })));
    setOpenMenuId('');
  };

  return (
    <div className="payout-accounts">
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
                className={`payout-provider-tab ${activeProvider === provider.value ? 'payout-provider-tab-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={activeProvider === provider.value}
                aria-controls="payout-provider-panel"
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
                  {providerAccounts.length
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
                  <div className="payout-account-card-menu">
                    <button type="button" disabled={account.isDefault} onClick={() => setDefault(account)}>
                      <Star size={14} />
                      {account.isDefault ? '当前默认账户' : '设为默认账户'}
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
                <small>可在下方新建账户，三种渠道资料相互独立。</small>
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
                onClick={() => addAccount(provider.value)}
              >
                {provider.label} 账户
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {selectedAccount?.provider === 'Airwallex' ? (
        editing
          ? <AirwallexAccountForm account={selectedAccount} onChange={replaceAccount} />
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
    </div>
  );
}
