import {
  AlertCircle,
  Ban,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  CloudCog,
  Landmark,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  Wallet,
  WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createEmptyAirwallexAccount,
  createEmptyPayMaxAccount,
  createEmptyPayPalAccount,
  AIRWALLEX_COUNTRIES,
  AIRWALLEX_CURRENCIES,
  canDeletePayoutAccount,
  canDisablePayoutAccount,
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
  AIRWALLEX_SCHEMA_API_VERSION,
  applyAirwallexSchemaDefaults,
  generateLocalAirwallexFormSchema,
  getAirwallexFormValue,
  getAirwallexSchemaConditionKey,
  getAirwallexSchemaGroup,
  setAirwallexFormValue,
  validateAirwallexFormSchema,
  type AirwallexFormSchemaField,
  type AirwallexFormSchemaOption,
} from '../airwallexFormSchema';
import {
  getAirwallexBeneficiaryFormSchema,
  getAirwallexDynamicOptions,
} from '../airwallexBeneficiaryApi';
import { getAirwallexSupplementalFields } from '../airwallexSupplementalFields';
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
    'beneficiary.bank_details.local_clearing_system': '本地清算方式',
    'beneficiary.address.state': 'Current address',
  }[item.path] ?? field.label;
  const value = getAirwallexFormValue(account, item.path) || field.default;
  const options = field.options ?? [];
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
        <code>
          {account.beneficiaryId
            ? `${account.beneficiaryEnvironment === 'MOCK' ? '模拟 · ' : ''}${account.beneficiaryId}`
            : 'beneficiary_id 待生成'}
        </code>
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
  const supplementalFields = useMemo(
    () => getAirwallexSupplementalFields(schema),
    [schema],
  );
  const fieldsFor = (group: ReturnType<typeof getAirwallexSchemaGroup>) => (
    enabledFields.filter((item) => getAirwallexSchemaGroup(item.path) === group)
  );
  const conditionFields = fieldsFor('condition');
  const identityFields = fieldsFor('identity');
  const addressFields = fieldsFor('address');
  const bankFields = fieldsFor('bank');

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
                : 'Airwallex Form Schema 本地预览'}
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
            ? '字段、必填规则和格式校验来自 Airwallex；付款路径变化后会重新获取 Schema。'
            : schemaStatus === 'mock'
              ? '字段由本地 Airwallex 模拟代理返回；用于联调和验收，不代表真实账户或真实 Airwallex 校验结果。'
            : schemaStatus === 'loading'
              ? '正在通过 COMETS Pay 服务端代理连接 Airwallex，请稍候。'
              : `${schemaError}。当前只显示本地预览；保存时不会伪造 Airwallex 校验或 beneficiary_id。`}
        </span>
        <code title={conditionKey}>condition {conditionKey}</code>
      </div>

      <Section icon={<Landmark size={19} />} title="账户配置" description="COMETS Pay 内部账户名称，不作为银行资料字段">
        <div className="form-grid creator-payment-form-grid">
          <TextField label="账户别名" alias="Internal nickname" value={account.nickname} onChange={(value) => commit({ ...account, nickname: value })} placeholder="例如：日本 JPY 主账户" required />
        </div>
      </Section>

      <Section icon={<CircleDollarSign size={19} />} title="付款路径" description="先选择收款国家、币种、收款人类型和转账方式，再由 Airwallex 决定后续字段">
        <div className="form-grid creator-payment-form-grid">
          {renderFields(conditionFields)}
        </div>
      </Section>

      <Section icon={<ShieldCheck size={19} />} title="收款主体" description="主体名称和身份字段完全按当前 Airwallex Form Schema 展示">
        <div className="form-grid creator-payment-form-grid">
          {renderFields(identityFields)}
        </div>
      </Section>

      {addressFields.length ? (
        <Section icon={<Building2 size={19} />} title="地址信息" description={schemaStatus === 'remote' || schemaStatus === 'mock' ? '仅显示当前 Form Schema 对该付款场景返回的地址字段' : 'Current address 为选填；街道、城市和邮编不写死在前端'}>
          <div className="form-grid creator-payment-form-grid">
            {renderFields(addressFields)}
          </div>
        </Section>
      ) : null}

      <Section icon={<Landmark size={19} />} title="付款信息" description="仅渲染当前 Form Schema 返回且 enabled=true 的银行字段">
        <div className="form-grid creator-payment-form-grid">
          {renderFields(bankFields)}
        </div>
      </Section>

      {supplementalFields.length ? (
        <Section icon={<Plus size={19} />} title="补充信息" description="来自 Airwallex 信息清单；仅补充当前付款字段未覆盖的非必填项，同义字段不会重复">
          <div className="form-grid creator-payment-form-grid airwallex-supplemental-grid">
            {supplementalFields.map((field) => (
              <TextField
                label={field.label}
                alias={`${field.sourceLabel} · 选填`}
                value={getAirwallexFormValue(account, field.path)}
                onChange={(value) => commit(setAirwallexFormValue(account, field.path, value))}
                placeholder={field.placeholder}
                type={field.type}
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
  const routing = [
    account.bankDetails.accountRoutingType1 && `${account.bankDetails.accountRoutingType1}: ${account.bankDetails.accountRoutingValue1 || '待补充'}`,
    account.bankDetails.accountRoutingType2 && `${account.bankDetails.accountRoutingType2}: ${account.bankDetails.accountRoutingValue2 || '待补充'}`,
  ].filter(Boolean).join(' · ');
  return (
    <div className="creator-profile-content payout-account-view">
      <StatusPanel account={account} />
      <Section icon={<ShieldCheck size={19} />} title="收款主体" description="Airwallex Beneficiary 身份和结构化地址">
        <DetailGrid items={[
          { label: '主体类型', alias: 'entity_type', value: account.entityType },
          { label: '法定名称', alias: account.entityType === 'COMPANY' ? 'company_name' : 'first_name / last_name', value: entityName },
          { label: '通知邮箱', alias: 'additional_info.personal_email', value: account.notificationEmail },
          { label: 'Current address', alias: 'beneficiary.address.state · 选填', value: account.address.state, wide: true },
        ]} />
      </Section>
      <Section icon={<CircleDollarSign size={19} />} title="付款路径" description="用于获取 Airwallex 动态 Schema">
        <DetailGrid items={[
          { label: '银行国家', alias: 'bank_country_code', value: `${account.bankDetails.bankCountryName} · ${account.bankDetails.bankCountryCode}` },
          { label: '账户币种', alias: 'account_currency', value: account.bankDetails.accountCurrency },
          { label: '转账方式', alias: 'transfer_method', value: account.transferMethod },
          { label: '本地清算方式', alias: 'local_clearing_system', value: account.transferMethod === 'LOCAL' ? account.bankDetails.localClearingSystem : '不适用' },
        ]} />
      </Section>
      <Section icon={<Landmark size={19} />} title="银行账户" description="账号默认掩码展示；字段是否必填由动态 Schema 决定">
        <DetailGrid items={[
          { label: '账户名称', alias: 'account_name', value: account.bankDetails.accountName },
          { label: '账户类型', alias: 'bank_account_category', value: account.bankDetails.bankAccountCategory },
          { label: '银行账号', alias: 'account_number', value: account.bankDetails.accountNumber, mask: true },
          { label: 'IBAN', alias: 'iban', value: account.bankDetails.iban, mask: true },
          { label: '本地路由', alias: 'account_routing_type / value', value: routing, wide: true },
          { label: '银行名称', alias: 'bank_name', value: account.bankDetails.bankName },
          { label: '分行名称', alias: 'bank_branch', value: account.bankDetails.bankBranch },
          { label: 'SWIFT / BIC', alias: 'swift_code', value: account.bankDetails.swiftCode },
          { label: '中间行', alias: 'intermediary_bank_name / swift_code', value: [account.bankDetails.intermediaryBankName, account.bankDetails.intermediaryBankSwiftCode].filter(Boolean).join(' · '), wide: true },
        ]} />
      </Section>
      <Section icon={<CheckCircle2 size={19} />} title="验证结果" description="接入后由 Validate 与 Verify Account API 回写">
        <DetailGrid items={[
          { label: '账户验证结果', alias: 'verificationCode', value: account.verificationCode || '尚未执行' },
          { label: '账户名匹配', alias: 'nameMatchResult', value: account.nameMatchResult || '尚未执行' },
          { label: '接口环境', alias: 'beneficiaryEnvironment', value: account.beneficiaryEnvironment || '尚未创建' },
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

export function CreatorPayoutAccounts({
  accounts,
  editing = false,
  creatorName,
  creatorEmail,
  onChange,
}: CreatorPayoutAccountsProps) {
  const defaultAccount = useMemo(() => getDefaultPayoutAccount(accounts), [accounts]);
  const [selectedId, setSelectedId] = useState(defaultAccount?.id ?? '');
  const [actionError, setActionError] = useState('');
  const selectedAccount = accounts.find((account) => account.id === selectedId) ?? defaultAccount;

  useEffect(() => {
    if (selectedAccount) return;
    setSelectedId(defaultAccount?.id ?? '');
  }, [defaultAccount?.id, selectedAccount]);

  const replaceAccount = (updated: CreatorPayoutAccount) => {
    onChange?.(accounts.map((account) => account.id === updated.id ? updated : account));
  };

  const addAirwallex = () => {
    const next = createEmptyAirwallexAccount(creatorName, creatorEmail);
    const normalized = accounts.length === 0
      ? next
      : { ...next, isDefault: false };
    onChange?.([...accounts, normalized]);
    setSelectedId(normalized.id);
  };

  const addPayPal = () => {
    const next = createEmptyPayPalAccount(creatorName, creatorEmail);
    const normalized = accounts.length === 0
      ? { ...next, isDefault: true }
      : next;
    onChange?.([...accounts, normalized]);
    setSelectedId(normalized.id);
  };

  const addPayMax = () => {
    const next = createEmptyPayMaxAccount(creatorName, creatorEmail);
    const normalized = accounts.length === 0
      ? { ...next, isDefault: true }
      : next;
    onChange?.([...accounts, normalized]);
    setSelectedId(normalized.id);
  };

  const setDefault = () => {
    if (!selectedAccount) return;
    if (!isPayoutAccountVerified(selectedAccount)) {
      setActionError('只有“格式校验通过”或“账户已验证”的账户可以设为默认。');
      return;
    }
    setActionError('');
    onChange?.(accounts.map((account) => ({ ...account, isDefault: account.id === selectedAccount.id })));
  };

  const removeAccount = () => {
    if (!selectedAccount || !canDeletePayoutAccount(selectedAccount)) return;
    if (selectedAccount.isDefault) {
      setActionError('删除默认账户前，请先选择另一条已验证账户并将其设为默认。');
      return;
    }
    if (!window.confirm(`确认删除“${selectedAccount.nickname}”？此操作仅允许无业务历史的草稿类账户。`)) return;
    const next = accounts.filter((account) => account.id !== selectedAccount.id);
    setSelectedId(next.find((account) => account.isDefault)?.id ?? next[0]?.id ?? '');
    setActionError('');
    onChange?.(next);
  };

  const disableAccount = () => {
    if (!selectedAccount || !canDisablePayoutAccount(selectedAccount)) return;
    if (selectedAccount.isDefault) {
      setActionError('停用默认账户前，请先选择另一条已验证账户并将其设为默认。');
      return;
    }
    const previousStatus = selectedAccount.status === 'DISABLED' ? 'DRAFT' : selectedAccount.status;
    onChange?.(accounts.map((account) => {
      if (account.id !== selectedAccount.id) return account;
      return { ...account, isDefault: false, status: 'DISABLED', statusBeforeDisabled: previousStatus };
    }));
    setActionError('');
  };

  const restoreAccount = () => {
    if (!selectedAccount || selectedAccount.status !== 'DISABLED') return;
    replaceAccount({
      ...selectedAccount,
      status: selectedAccount.statusBeforeDisabled ?? 'DRAFT',
      statusBeforeDisabled: undefined,
      isDefault: false,
    });
    setActionError('');
  };

  const usableAccountCount = accounts.filter(isPayoutAccountVerified).length;

  return (
    <div className="payout-accounts">
      <div className="payout-account-toolbar">
        <div className="payout-account-availability">
          <strong>{usableAccountCount}</strong>
          <span>个可用于付款的账户</span>
        </div>
        <div className="payout-account-tabs" role="tablist" aria-label="达人收款账户">
          {accounts.map((account) => {
            const status = getPayoutAccountStatusMeta(account.status, account.provider);
            return (
              <button
                className={`payout-account-tab ${selectedAccount?.id === account.id ? 'payout-account-tab-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={selectedAccount?.id === account.id}
                key={account.id}
                onClick={() => setSelectedId(account.id)}
              >
                <span className="payout-account-tab-icon">
                  {account.provider === 'Airwallex'
                    ? <Landmark size={17} />
                    : account.provider === 'PayPal'
                      ? <Wallet size={17} />
                      : <CircleDollarSign size={17} />}
                </span>
                <span><strong>{account.nickname}</strong><small>{getPayoutAccountSummary(account)} · {getPayoutAccountIdentifier(account)}</small></span>
                <em className={`payout-account-mini-status payout-account-mini-status-${status.tone}`}>{status.label}</em>
                {account.isDefault ? <Star className="payout-account-default-star" size={14} fill="currentColor" aria-label="默认账户" /> : null}
              </button>
            );
          })}
        </div>
        {editing && selectedAccount ? (
          <div className="payout-account-actions">
            {selectedAccount && !selectedAccount.isDefault ? <Button variant="ghost" icon={<Star size={15} />} onClick={setDefault}>设为默认</Button> : null}
            {selectedAccount?.status === 'DISABLED'
              ? <Button variant="secondary" icon={<RotateCcw size={15} />} onClick={restoreAccount}>重新启用</Button>
              : null}
            {selectedAccount && canDeletePayoutAccount(selectedAccount)
              ? <Button variant="ghost" icon={<Trash2 size={15} />} onClick={removeAccount}>删除</Button>
              : null}
            {selectedAccount && !canDeletePayoutAccount(selectedAccount) && canDisablePayoutAccount(selectedAccount)
              ? <Button variant="ghost" icon={<Ban size={15} />} onClick={disableAccount}>停用</Button>
              : null}
            <Button variant="secondary" icon={<Plus size={15} />} onClick={addAirwallex}>Airwallex 账户</Button>
            <Button variant="secondary" icon={<Plus size={15} />} onClick={addPayPal}>PayPal 账户</Button>
            <Button variant="secondary" icon={<Plus size={15} />} onClick={addPayMax}>PayerMax 账户</Button>
          </div>
        ) : null}
      </div>
      {selectedAccount?.activePaymentId ? <p className="payout-account-action-error">账户正在处理付款 {selectedAccount.activePaymentId}，当前禁止停用或删除。</p> : null}
      {actionError ? <p className="payout-account-action-error" role="alert">{actionError}</p> : null}

      {!selectedAccount ? (
        <div className="payout-account-empty">
          <Landmark size={24} />
          <strong>尚未建立收款账户</strong>
          <span>选择付款渠道并新建对应的收款账户；三种渠道的资料和校验状态互不覆盖。</span>
          {editing ? (
            <div className="payout-channel-picker" aria-label="选择付款渠道">
              <Button variant="secondary" icon={<Landmark size={15} />} onClick={addAirwallex}>Airwallex</Button>
              <Button variant="secondary" icon={<Wallet size={15} />} onClick={addPayPal}>PayPal</Button>
              <Button variant="secondary" icon={<CircleDollarSign size={15} />} onClick={addPayMax}>PayerMax</Button>
            </div>
          ) : null}
        </div>
      ) : selectedAccount.provider === 'Airwallex' ? (
        editing
          ? <AirwallexAccountForm account={selectedAccount} onChange={replaceAccount} />
          : <AirwallexAccountView account={selectedAccount} />
      ) : selectedAccount.provider === 'PayPal' ? (
        editing
          ? <PayPalAccountForm account={selectedAccount} onChange={replaceAccount} />
          : <PayPalAccountView account={selectedAccount} />
      ) : (
        editing
          ? <PayMaxAccountForm account={selectedAccount} onChange={replaceAccount} />
          : <PayMaxAccountView account={selectedAccount} />
      )}
    </div>
  );
}
