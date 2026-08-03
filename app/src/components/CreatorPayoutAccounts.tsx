import {
  AlertCircle,
  Braces,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Landmark,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createEmptyAirwallexAccount,
  createEmptyPayPalAccount,
  getDefaultPayoutAccount,
  getPayoutAccountIdentifier,
  getPayoutAccountStatusMeta,
  getPayoutAccountSummary,
  invalidateAirwallexVerification,
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
} from '../airwallexFormSchema';
import type {
  AirwallexPayoutAccount,
  CreatorPayoutAccount,
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
  type?: 'text' | 'email';
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
      <FieldLabel label={field.label} alias={item.path} required={item.required} />
      {isChoice ? (
        <div className={`schema-choice-group ${field.type === 'TRANSFER_METHOD' ? 'schema-choice-group-wide' : ''}`} role="radiogroup" aria-label={field.label}>
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
          ariaLabel={field.label}
          variant="form"
          value={value}
          options={options}
          placeholder={field.placeholder || `选择${field.label}`}
          onChange={onChange}
        />
      ) : (
        <div className={isDynamic ? 'schema-dynamic-input' : undefined}>
          {isDynamic ? <Search size={15} aria-hidden="true" /> : null}
          <input
            aria-label={field.label}
            type={inputType}
            value={value}
            placeholder={field.placeholder || (field.example ? `例如：${field.example}` : `请输入${field.label}`)}
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
  const schema = useMemo(() => generateLocalAirwallexFormSchema(account), [account]);
  const conditionKey = getAirwallexSchemaConditionKey(account);
  const issues = useMemo(() => validateAirwallexFormSchema(account, schema), [account, schema]);
  const issuesByPath = useMemo(
    () => new Map(issues.map((issue) => [issue.path, issue.message])),
    [issues],
  );
  const enabledFields = schema.fields.filter((item) => item.enabled);
  const requiredFields = schema.fields.filter((item) => item.enabled && item.required);
  const fieldsFor = (group: ReturnType<typeof getAirwallexSchemaGroup>) => (
    enabledFields.filter((item) => getAirwallexSchemaGroup(item.path) === group)
  );
  const conditionFields = fieldsFor('condition');
  const identityFields = fieldsFor('identity');
  const addressFields = fieldsFor('address');
  const bankFields = fieldsFor('bank');

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
    <div className="creator-payment-editor payout-account-form">
      <StatusPanel account={account} />
      <div className="dynamic-schema-note">
        <Braces size={18} />
        <span>
          <strong>Airwallex Form Schema 已按当前条件生成</strong>
          <small>
            {account.bankDetails.bankCountryCode || '银行国家'} · {account.bankDetails.accountCurrency || '账户币种'} · {account.entityType} · {account.transferMethod}
            {account.transferMethod === 'LOCAL' && account.bankDetails.localClearingSystem ? ` · ${account.bankDetails.localClearingSystem}` : ''}
            {' '}· 地址 {account.address.countryCode || '待选'}
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
        <RefreshCw size={14} />
        <span>
          当前无 Airwallex 凭证，页面使用与官方响应同结构的本地 Schema 预览。
          生产环境应由服务端代理实时请求；带“变更后刷新 Schema”的字段变化时重新获取，不在前端保存 API Token。
        </span>
        <code title={conditionKey}>condition {conditionKey}</code>
      </div>

      <Section icon={<Landmark size={19} />} title="账户配置" description="以下为 MUSE Pay 内部账户字段，不会提交到 Airwallex Beneficiary API">
        <div className="form-grid creator-payment-form-grid">
          <TextField label="账户别名" alias="Internal nickname" value={account.nickname} onChange={(value) => onChange({ ...account, nickname: value })} placeholder="例如：日本 JPY 主账户" required />
        </div>
      </Section>

      <Section icon={<ShieldCheck size={19} />} title="收款主体" description="主体类型和法定名称由当前 Schema 决定，并用于合规及账户名校验">
        <div className="form-grid creator-payment-form-grid">
          {renderFields(identityFields)}
        </div>
      </Section>

      <Section icon={<Building2 size={19} />} title="收款人地址" description="这是个人或企业地址，不是银行地址；国家变化会刷新地址字段规则">
        <div className="form-grid creator-payment-form-grid">
          {renderFields(addressFields)}
        </div>
      </Section>

      <Section icon={<CircleDollarSign size={19} />} title="付款路径" description="银行国家、币种、LOCAL / SWIFT 和清算网络共同决定后续银行字段">
        <div className="form-grid creator-payment-form-grid">
          {renderFields(conditionFields)}
        </div>
      </Section>

      <Section icon={<Landmark size={19} />} title="银行账户" description="仅渲染当前 Form Schema 返回且 enabled=true 的字段；必填和格式也来自 Schema">
        <div className="form-grid creator-payment-form-grid">
          {renderFields(bankFields)}
        </div>
      </Section>
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
  return (
    <div className="creator-profile-content payout-account-view">
      <StatusPanel account={account} />
      <Section icon={<ShieldCheck size={19} />} title="收款主体" description="Airwallex Beneficiary 身份和结构化地址">
        <DetailGrid items={[
          { label: '主体类型', alias: 'entity_type', value: account.entityType },
          { label: '法定名称', alias: account.entityType === 'COMPANY' ? 'company_name' : 'first_name / last_name', value: entityName },
          { label: '通知邮箱', alias: 'additional_info.personal_email', value: account.notificationEmail },
          { label: '收款人地址', alias: 'beneficiary.address', value: address, wide: true },
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

export function CreatorPayoutAccounts({
  accounts,
  editing = false,
  creatorName,
  creatorEmail,
  onChange,
}: CreatorPayoutAccountsProps) {
  const defaultAccount = useMemo(() => getDefaultPayoutAccount(accounts), [accounts]);
  const [selectedId, setSelectedId] = useState(defaultAccount?.id ?? '');
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

  const setDefault = () => {
    if (!selectedAccount) return;
    onChange?.(accounts.map((account) => ({ ...account, isDefault: account.id === selectedAccount.id })));
  };

  return (
    <div className="payout-accounts">
      <div className="payout-account-toolbar">
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
                <span className="payout-account-tab-icon">{account.provider === 'Airwallex' ? <Landmark size={17} /> : <Wallet size={17} />}</span>
                <span><strong>{account.nickname}</strong><small>{getPayoutAccountSummary(account)} · {getPayoutAccountIdentifier(account)}</small></span>
                <em className={`payout-account-mini-status payout-account-mini-status-${status.tone}`}>{status.label}</em>
                {account.isDefault ? <Star className="payout-account-default-star" size={14} fill="currentColor" aria-label="默认账户" /> : null}
              </button>
            );
          })}
        </div>
        {editing ? (
          <div className="payout-account-actions">
            {selectedAccount && !selectedAccount.isDefault ? <Button variant="ghost" icon={<Star size={15} />} onClick={setDefault}>设为默认</Button> : null}
            <Button variant="secondary" icon={<Plus size={15} />} onClick={addAirwallex}>Airwallex 账户</Button>
            <Button variant="secondary" icon={<Plus size={15} />} onClick={addPayPal}>PayPal 账户</Button>
          </div>
        ) : null}
      </div>

      {!selectedAccount ? (
        <div className="payout-account-empty">
          <Landmark size={24} />
          <strong>尚未建立收款账户</strong>
          <span>新增 Airwallex 或 PayPal 账户后，才能进入付款资料校验。</span>
          {editing ? <Button icon={<Plus size={15} />} onClick={addAirwallex}>新增 Airwallex 账户</Button> : null}
        </div>
      ) : selectedAccount.provider === 'Airwallex' ? (
        editing
          ? <AirwallexAccountForm account={selectedAccount} onChange={replaceAccount} />
          : <AirwallexAccountView account={selectedAccount} />
      ) : (
        editing
          ? <PayPalAccountForm account={selectedAccount} onChange={replaceAccount} />
          : <PayPalAccountView account={selectedAccount} />
      )}
    </div>
  );
}
