import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  Download,
  ExternalLink,
  FileSignature,
  FileSearch,
  FileText,
  Link2,
  Landmark,
  Pencil,
  Power,
  PowerOff,
  ReceiptText,
  ShieldCheck,
  Unlink,
  Upload,
  X,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { accountDisplayValue } from '../accountPresentation';
import { Button, Modal, PageHeading, SelectField } from '../components/Common';
import { ContractUploadWizard } from '../components/ContractUploadWizard';
import { ContractDocumentView } from '../components/ContractDocumentView';
import { ContractTemplateFieldEditor } from '../components/ContractTemplateFieldEditor';
import {
  canConfirmRecognitionFields,
  confirmRecognitionFields,
  contractExpiryRangeValidationMessage,
  editContractExpiryRange,
  editPlatformChannelRecognitionField,
  editRecognitionField,
  isContractExpiryRangeValid,
  normalizeContractRecognitionFields,
  recognitionFieldDisplayValue,
  reopenRecognitionFields,
} from '../contractRecognition';
import {
  CONTRACT_UPLOAD_BANK_FIELD_KEYS,
  CONTRACT_UPLOAD_PAYPAL_FIELD_KEYS,
  CONTRACT_DOCUMENT_TYPE_LABELS,
  type ContractFieldCandidate,
  type ContractFieldKey,
  type ContractRecognitionField,
  type ContractSourceLocation,
} from '../contractRecognitionTypes';
import {
  CONTRACT_TYPE_LABELS,
  applyConfirmedRecognitionToContract,
  completeContractSignature,
  formatContractMoney,
  frameworkIoContracts,
  getContractType,
  getContractReadiness,
  getContractValidity,
  isFrameworkContract,
  isIoContract,
  projectConfirmedRecognitionDraft,
  sendContractForSignature,
  type ContractSignaturePaymentInformation,
  type ContractType,
  type ContractRecognizedAccountSnapshot,
  type ContractRecord,
  type ContractUploadInput,
} from '../contracts';
import {
  createContractSignatureRequest,
  sendContractSignatureRequest,
  simulateDocuSignContractSend,
  type ContractSignatureSender,
} from '../contractSignature';
import { contractDocumentFilename } from '../documentFilenames';
import { resolveSystemUser } from '../data';
import type { ContractId } from '../businessWorkflow';
import type { PaymentRequestProjectLike } from '../paymentRequestProjects';
import { normalizePaymentProviderName, paymentProviderDisplayName } from '../paymentProviderPresentation';
import { invoicePaymentForCreator } from '../payoutAccounts';
import type { CreatorProfile, DocumentPayoutSnapshot } from '../types';
import type { ProjectSummary } from './ProjectDetailPage';
import {
  createContractTemplateStatusUpdate,
  getContractTemplatePolicyReadiness,
  getContractTemplateStatus,
  type ContractTemplatePolicyIssue,
} from '../contractTemplateFieldPolicies';

type ContractDetailTab = 'summary' | 'payment' | 'checks';
type Notify = (title: string, message: string) => void;

type ContractDetailFieldKey = ContractFieldKey | 'campaignEnd' | 'socialPlatform' | 'channelLink';

type ContractDetailField = {
  key: ContractDetailFieldKey;
  label: string;
};

type ContractPaymentRuleKey =
  | 'projectTotalFees'
  | 'paymentMethod'
  | 'transferFee';

type ContractPaymentField = {
  key: ContractPaymentRuleKey;
  label: string;
};

const isRecognitionFieldKey = (
  key: ContractDetailField['key'],
): key is ContractFieldKey => !['campaignEnd', 'socialPlatform', 'channelLink'].includes(key);

const recognitionFieldHasValue = (field: ContractRecognitionField | undefined) => Boolean(
  field && (field.editedValue?.trim() || field.rawValue.trim()),
);

export const contractRecognitionKeysToConfirm = (
  fields: ContractRecognitionField[],
  fieldKeys: readonly ContractFieldKey[],
) => fieldKeys.filter((fieldKey) => {
  const field = fields.find((item) => item.fieldKey === fieldKey);
  if (field?.readOnly) return false;
  if (field?.requiredForConfirmation === false) return recognitionFieldHasValue(field);
  return fieldKey !== 'platformChannel' || recognitionFieldHasValue(field);
});

const SUMMARY_FIELDS_BY_TYPE: Record<ContractType, ContractDetailField[]> = {
  INDEPENDENT: [
    { key: 'advertiser', label: 'Advertiser' },
    { key: 'publisher', label: 'Publisher' },
    { key: 'contractNumber', label: '合同编号' },
    { key: 'projectBrand', label: 'Project Name' },
    { key: 'socialPlatform', label: '社媒平台（可选）' },
    { key: 'channelLink', label: '频道链接（可选）' },
    { key: 'campaignEnd', label: '合同有效期' },
    { key: 'signatureStatus', label: '签署状态' },
  ],
  FRAMEWORK: [
    { key: 'advertiser', label: 'Advertiser' },
    { key: 'publisher', label: 'Publisher' },
    { key: 'contractNumber', label: '合同编号' },
    { key: 'campaignEnd', label: '合同有效期' },
    { key: 'signatureStatus', label: '签署状态' },
  ],
  IO: [
    { key: 'advertiser', label: 'Advertiser' },
    { key: 'publisher', label: 'Publisher' },
    { key: 'contractNumber', label: '合同编号' },
    { key: 'projectBrand', label: 'Project Name' },
    { key: 'socialPlatform', label: '社媒平台（可选）' },
    { key: 'channelLink', label: '频道链接（可选）' },
    { key: 'campaignEnd', label: '合同有效期' },
    { key: 'signatureStatus', label: '签署状态' },
  ],
};

export const contractSummaryFieldsFor = (contractType: ContractType) => (
  SUMMARY_FIELDS_BY_TYPE[contractType]
);

const PAYMENT_FIELDS_BY_TYPE: Record<ContractType, ContractPaymentField[]> = {
  INDEPENDENT: [
    { key: 'projectTotalFees', label: '付款金额' },
    { key: 'paymentMethod', label: '付款渠道' },
    { key: 'transferFee', label: '手续费费用承担方' },
  ],
  FRAMEWORK: [
    { key: 'transferFee', label: '手续费费用承担方' },
  ],
  IO: [
    { key: 'projectTotalFees', label: '付款金额' },
    { key: 'paymentMethod', label: '付款渠道' },
  ],
};

export const contractPaymentFieldsFor = (contractType: ContractType) => (
  PAYMENT_FIELDS_BY_TYPE[contractType]
);

const DETAIL_FIELD_LABELS: Partial<Record<ContractFieldKey, string>> = Object.fromEntries(
  [...SUMMARY_FIELDS_BY_TYPE.INDEPENDENT, ...PAYMENT_FIELDS_BY_TYPE.INDEPENDENT]
    .filter((field): field is { key: ContractFieldKey; label: string } => isRecognitionFieldKey(field.key))
    .map((field) => [field.key, field.label]),
) as Partial<Record<ContractFieldKey, string>>;

export const contractExpiryDisplayValue = (
  contract: Pick<ContractRecord, 'campaignEnd' | 'isLongTerm'>
    & Partial<Pick<ContractRecord, 'campaignStart'>>,
) => {
  const validity = getContractValidity(contract);
  if (validity.status === 'LONG_TERM') return '长期有效';
  if (validity.status === 'UNSET') return '未设置';
  return contract.campaignStart
    ? `${contract.campaignStart} 至 ${validity.endDate}`
    : validity.endDate;
};

export const contractSignatureStatusLabel = (
  contract: Pick<ContractRecord, 'isTemplate' | 'lifecycle' | 'signed'>,
) => {
  if (contract.isTemplate) return '不适用';
  if (contract.signed) return '已签署';
  if (contract.lifecycle === 'SENT_FOR_SIGNATURE') return '待达人签署';
  return '未签署';
};

const FEE_BEARER_LABELS = {
  ADVERTISER: 'Advertiser承担',
  PUBLISHER: 'Publisher承担',
  SHARED: '双方共同承担',
  '': '待选择',
} as const;

const PAYMENT_METHOD_LABELS = {
  BANK: '银行转账',
  PAYPAL: 'PayPal',
  AIRWALLEX: 'Airwallex',
  '': '待补充',
} as const;

type ContractPaymentIdentity = Pick<ContractRecord, 'payoutProvider' | 'paymentMethod'>;

export type ContractPaymentDisplayRow = {
  key: string;
  label: string;
  value: string;
};

const paymentProviderForContract = (
  contract: ContractPaymentIdentity,
  paymentSnapshot: DocumentPayoutSnapshot | null,
) => paymentSnapshot?.payoutProvider || contract.payoutProvider;

export const contractPaymentChannelDisplayValue = (
  contract: ContractPaymentIdentity,
  paymentSnapshot: DocumentPayoutSnapshot | null,
) => {
  const provider = paymentProviderForContract(contract, paymentSnapshot);
  return provider
    ? paymentProviderDisplayName(provider)
    : PAYMENT_METHOD_LABELS[contract.paymentMethod] || '待补充';
};

export const contractPaymentAccountRows = (
  contract: ContractPaymentIdentity,
  paymentSnapshot: DocumentPayoutSnapshot | null,
): ContractPaymentDisplayRow[] => {
  const snapshotValue = (value?: string | null) => value?.trim() || '待补充';
  const provider = normalizePaymentProviderName(paymentProviderForContract(contract, paymentSnapshot));
  const isPayPal = provider === 'PayPal' || (!provider && contract.paymentMethod === 'PAYPAL');

  if (isPayPal) {
    return [
      { key: 'paypal-username', label: 'PayPal Username', value: accountDisplayValue(paymentSnapshot?.paypalUsername) },
      { key: 'paypal-email', label: 'PayPal Email Address', value: accountDisplayValue(paymentSnapshot?.paypalEmail) },
      { key: 'transfer-note', label: 'Transfer Note (optional)', value: snapshotValue(paymentSnapshot?.transferRemarks) },
    ];
  }

  const bankAddress = [
    paymentSnapshot?.bankStreetAddress,
    paymentSnapshot?.bankCity,
    paymentSnapshot?.bankState,
    paymentSnapshot?.bankPostalCode,
    paymentSnapshot?.bankCountry,
  ].map((value) => value?.trim()).filter(Boolean).join(', ');

  return [
    { key: 'account-name', label: 'Account Name', value: accountDisplayValue(paymentSnapshot?.accountName) },
    { key: 'account-number', label: 'Account Number', value: accountDisplayValue(paymentSnapshot?.accountNumber) },
    { key: 'beneficiary-bank-name', label: 'Beneficiary Bank Name', value: snapshotValue(paymentSnapshot?.bankName) },
    { key: 'beneficiary-bank-address', label: 'Beneficiary Bank Address', value: snapshotValue(bankAddress) },
    { key: 'swift-code', label: 'SWIFT Code', value: accountDisplayValue(paymentSnapshot?.swiftCode) },
    { key: 'iban', label: 'IBAN', value: accountDisplayValue(paymentSnapshot?.iban) },
    { key: 'remittance-information', label: 'Remittance Information (optional)', value: snapshotValue(paymentSnapshot?.transferRemarks) },
  ];
};

export const contractRecognizedAccountRows = (
  snapshot: ContractRecognizedAccountSnapshot,
): ContractPaymentDisplayRow[] => {
  const value = (item?: string) => item?.trim() || '待补充';
  const rows: ContractPaymentDisplayRow[] = [];
  if (snapshot.detectedChannel === 'BANK' || snapshot.detectedChannel === 'MIXED') {
    rows.push(
      { key: 'recognized-account-name', label: 'Account Name', value: accountDisplayValue(snapshot.accountName) },
      { key: 'recognized-account-number', label: 'Account Number', value: accountDisplayValue(snapshot.accountNumber) },
      { key: 'recognized-beneficiary-bank-name', label: 'Beneficiary Bank Name', value: value(snapshot.beneficiaryBankName) },
      { key: 'recognized-beneficiary-bank-address', label: 'Beneficiary Bank Address', value: value(snapshot.beneficiaryBankAddress) },
      { key: 'recognized-swift-code', label: 'SWIFT Code', value: accountDisplayValue(snapshot.swiftCode) },
      { key: 'recognized-iban', label: 'IBAN', value: accountDisplayValue(snapshot.iban) },
      { key: 'recognized-remittance-information', label: 'Remittance Information (optional)', value: value(snapshot.remittanceInformation) },
    );
  }
  if (snapshot.detectedChannel === 'PAYPAL' || snapshot.detectedChannel === 'MIXED') {
    rows.push(
      { key: 'recognized-paypal-username', label: 'PayPal Username', value: accountDisplayValue(snapshot.paypalUsername) },
      { key: 'recognized-paypal-email', label: 'PayPal Email Address', value: accountDisplayValue(snapshot.paypalEmail) },
      { key: 'recognized-transfer-note', label: 'Transfer Note (optional)', value: value(snapshot.transferNote) },
    );
  }
  return rows;
};

export const contractSignaturePaymentInformationFor = (
  contract: ContractRecord,
  paymentSnapshot: DocumentPayoutSnapshot | null,
): ContractSignaturePaymentInformation => {
  const frozenRows = contractPaymentAccountRows(contract, paymentSnapshot);
  const frozenByLabel = new Map(frozenRows.map((row) => [row.label, row.value]));
  const recognizedRows = contract.recognizedPaymentDetails
    ? contractRecognizedAccountRows(contract.recognizedPaymentDetails).map((row) => ({
        ...row,
        value: row.value === '待补充'
          ? frozenByLabel.get(row.label) ?? row.value
          : row.value,
      }))
    : [];
  const usesRecognizedSnapshot = recognizedRows.length > 0;
  const channel = contract.recognizedPaymentDetails?.detectedChannel === 'PAYPAL'
    ? 'PayPal'
    : contract.recognizedPaymentDetails?.detectedChannel === 'BANK'
      ? '银行转账'
      : contract.recognizedPaymentDetails?.detectedChannel === 'MIXED'
        ? '银行转账 / PayPal'
        : contractPaymentChannelDisplayValue(contract, paymentSnapshot);
  return {
    source: usesRecognizedSnapshot ? 'recognized-contract' : 'frozen-payout-account',
    channel,
    fields: (usesRecognizedSnapshot ? recognizedRows : frozenRows).map((row) => ({
      label: row.label,
      value: row.value,
    })),
  };
};

const createDemoAirwallexSnapshot = (contract: ContractRecord): DocumentPayoutSnapshot => {
  const accountName = contract.accountName || contract.publisher || 'Demo Creator';
  const accountTail = contract.id.replace(/\D/g, '').slice(-4).padStart(4, '0');
  return {
    creatorId: contract.creatorId,
    payoutAccountId: `demo-awx-${accountTail}`,
    payoutAccountVersion: 'v1',
    payoutProvider: 'Airwallex',
    providerAccountScope: 'mock:default',
    externalBeneficiaryId: `mock_beneficiary_${accountTail}`,
    accountFingerprint: contract.accountFingerprint || `fp_demo_awx_${accountTail}`,
    schemaKey: 'BANK_ACCOUNT:US',
    validationStatus: 'VERIFIED',
    bankCountry: 'United States',
    accountName,
    accountType: 'Checking',
    swiftCode: 'CHASUS33',
    accountNumber: `5000${accountTail}`,
    iban: '',
    beneficiaryType: 'PERSONAL',
    bankName: 'JPMorgan Chase Bank',
    bankStreetAddress: '270 Park Avenue',
    bankCity: 'New York',
    bankState: 'NY',
    bankPostalCode: '10017',
    intermediaryBankCountry: '',
    intermediaryBankCode: '',
    transferRemarks: `COMETS ${contract.id} payout`,
    paypalUsername: '',
    paypalEmail: '',
    transferMethod: 'LOCAL',
    localClearingSystem: 'ACH',
    accountCurrency: contract.currency || 'USD',
    validatedAt: '2026-08-12T10:30:00.000Z',
    verifiedAt: '2026-08-12T10:35:00.000Z',
    schemaValues: {},
    schemaFields: [],
  };
};

const FIELD_STATUS_LABELS = {
  detected: '待确认',
  missing: '待补充',
  conflict: '需核对',
  confirmed: '已确认',
} as const;

const CONTRACT_SOCIAL_PLATFORM_OPTIONS = [
  { value: 'YouTube', label: 'YouTube' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'Twitch', label: 'Twitch' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'Facebook', label: 'Face Book' },
  { value: 'X', label: 'X' },
  { value: 'SOOP', label: 'SOOP' },
  { value: 'CHZZK', label: 'CHZZK' },
] as const;

const sourceLabel = (source: ContractSourceLocation | null) => {
  if (!source) return '未找到可靠来源';
  const documentLabel = source.documentId === 'system-contract'
    ? '系统字段'
    : CONTRACT_DOCUMENT_TYPE_LABELS[source.documentType];
  return source.pageNumber
    ? `${documentLabel} · 第 ${source.pageNumber} 页`
    : `${documentLabel} · ${source.section}`;
};

function ContractDefinitionList({
  contract,
  fields,
  projectName,
  formalFieldsHidden = false,
}: {
  contract: ContractRecord;
  fields: ContractDetailField[];
  projectName: string;
  formalFieldsHidden?: boolean;
}) {
  const valueFor = (key: ContractDetailField['key']) => {
    if (formalFieldsHidden && key !== 'contractNumber' && key !== 'signatureStatus') return '待补充';
    switch (key) {
      case 'advertiser': return contract.advertiser || '待识别';
      case 'publisher': return contract.publisher || '待补充';
      case 'contractNumber': return contract.id;
      case 'projectBrand': return projectName || '待补充';
      case 'socialPlatform': return contract.platform || contract.creatorPlatform || '待补充';
      case 'channelLink': return contract.channelLink || '待补充';
      case 'campaignEnd': return contractExpiryDisplayValue(contract);
      case 'signatureStatus': return contractSignatureStatusLabel(contract);
      case 'effectiveDate': return contract.effectiveDate || '待补充';
      default: return '待补充';
    }
  };
  return (
    <dl className="contract-definition-list">
      {fields.map((field) => (
        <div key={field.key}>
          <dt>{field.label}</dt>
          <dd>
            {field.key === 'channelLink' && contract.channelLink ? (
              <a className="contract-definition-link" href={contract.channelLink} target="_blank" rel="noreferrer">
                {contract.channelLink}
                <ExternalLink size={12} />
              </a>
            ) : valueFor(field.key)}
            <small>{field.key === 'contractNumber'
              ? '系统字段'
              : field.key === 'signatureStatus'
                ? '根据当前签署流程派生'
                : '合同识别 / 人工确认'}</small>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ContractPaymentList({
  contract,
  fields,
  paymentSnapshot,
  formalFieldsHidden = false,
}: {
  contract: ContractRecord;
  fields: ContractPaymentField[];
  paymentSnapshot: DocumentPayoutSnapshot | null;
  formalFieldsHidden?: boolean;
}) {
  const valueFor = (key: ContractPaymentRuleKey) => {
    if (formalFieldsHidden) return '待补充';
    switch (key) {
      case 'projectTotalFees': return formatContractMoney(contract);
      case 'paymentMethod': return contract.recognizedPaymentDetails?.detectedChannel === 'PAYPAL'
        ? 'PayPal'
        : contract.recognizedPaymentDetails?.detectedChannel === 'BANK'
          ? '银行转账'
          : contract.recognizedPaymentDetails?.detectedChannel === 'MIXED'
            ? '银行转账 / PayPal'
            : contractPaymentChannelDisplayValue(contract, paymentSnapshot);
      case 'transferFee': return FEE_BEARER_LABELS[contract.feeBearer];
      default: return '待补充';
    }
  };
  const rows: ContractPaymentDisplayRow[] = [
    ...fields.map((field) => ({ key: field.key, label: field.label, value: valueFor(field.key) })),
    ...(contract.recognizedPaymentDetails
      ? contractRecognizedAccountRows(contract.recognizedPaymentDetails)
      : contractPaymentAccountRows(contract, paymentSnapshot)),
  ];
  return (
    <dl className="contract-payment-list contract-payment-rules-list">
      {rows.map((row) => (
        <div key={row.key}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RecognitionFieldList({
  fields,
  fieldKeys,
  onChange,
  onChangeExpiry,
  onChangePlatformChannel,
  onSelectCandidate,
  onOpenSource,
  fieldLabels = {},
  recognitionLocked = false,
}: {
  fields: ContractRecognitionField[];
  fieldKeys: ContractFieldKey[];
  onChange: (fieldKey: ContractFieldKey, value: string) => void;
  onChangeExpiry: (startDate: string, endDate: string) => void;
  onChangePlatformChannel: (patch: { platform?: string; channelUrl?: string }) => void;
  onSelectCandidate: (fieldKey: ContractFieldKey, candidate: ContractFieldCandidate) => void;
  onOpenSource: (source: ContractSourceLocation) => void;
  fieldLabels?: Partial<Record<ContractFieldKey, string>>;
  recognitionLocked?: boolean;
}) {
  return (
    <div className="contract-recognition-detail-list">
      {fieldKeys.map((fieldKey) => {
        const field = fields.find((item) => item.fieldKey === fieldKey);
        if (!field) return null;
        const fieldLocked = recognitionLocked || field.status === 'confirmed' || field.readOnly;
        const signatureValue = field.fieldKey === 'signatureStatus'
          && field.normalizedValue
          && typeof field.normalizedValue === 'object'
          && 'signed' in field.normalizedValue
          ? (field.normalizedValue as { signed?: boolean }).signed ? 'SIGNED' : 'UNSIGNED'
          : '';
        const expiryValue = field.fieldKey === 'contractExpiry'
          && field.normalizedValue
          && typeof field.normalizedValue === 'object'
          ? field.normalizedValue as { startDate?: string; endDate?: string; isLongTerm?: boolean }
          : undefined;
        const expiryStartDate = expiryValue?.startDate?.trim() ?? '';
        const expiryDate = expiryValue?.endDate?.trim() ?? '';
        const expiryError = field.fieldKey === 'contractExpiry'
          ? contractExpiryRangeValidationMessage(field.normalizedValue)
          : '';
        const platformChannelValue = field.fieldKey === 'platformChannel'
          && field.normalizedValue
          && typeof field.normalizedValue === 'object'
          ? field.normalizedValue as { platform?: string; channelUrl?: string }
          : undefined;
        const socialPlatform = platformChannelValue?.platform === 'Face Book'
          ? 'Facebook'
          : platformChannelValue?.platform?.trim() ?? '';
        const channelUrl = platformChannelValue?.channelUrl?.trim() ?? '';
        const fieldMetadata = (
          <>
            {field.source ? (
              <button className="contract-recognition-source" type="button" onClick={() => onOpenSource(field.source!)}>
                <FileSearch size={12} />
                {sourceLabel(field.source)}
              </button>
            ) : <small className="contract-recognition-missing-source">未识别，需人工补充</small>}
            {field.status === 'conflict' && field.candidates.length > 1 ? (
              <div className="contract-recognition-candidates">
                <strong><AlertTriangle size={13} />发现多个候选，请选择后确认</strong>
                {field.candidates.map((candidate, index) => (
                  <button type="button" key={`${candidate.source.blockId}-${index}`} onClick={() => onSelectCandidate(field.fieldKey, candidate)}>
                    <span>{candidate.rawValue}</span>
                    <small>{sourceLabel(candidate.source)}</small>
                  </button>
                ))}
              </div>
            ) : null}
            {field.profileComparison?.status === 'conflict' ? (
              <div className="contract-recognition-profile-conflict">
                <AlertTriangle size={13} />
                <span>与达人档案账户不一致：{field.profileComparison.referenceLabels.join('、')}。合同值仅用于比对，不会覆盖达人档案。</span>
              </div>
            ) : null}
          </>
        );
        return (
          <Fragment key={field.fieldKey}>
            <article
              className={`contract-recognition-detail contract-recognition-field-${field.status}${field.fieldKey === 'platformChannel' ? ' contract-recognition-platform-channel-detail' : ''}${fieldLocked ? ' contract-recognition-detail-readonly' : ''}`}
            >
              {field.fieldKey === 'platformChannel' ? (
                <div className="contract-recognition-platform-channel-fields">
                  <label>
                    <span className="contract-recognition-label">社媒平台</span>
                    <SelectField<string>
                      ariaLabel="社媒平台"
                      variant="form"
                      menuStrategy="fixed"
                      value={socialPlatform}
                      placeholder="待选择"
                      options={CONTRACT_SOCIAL_PLATFORM_OPTIONS}
                      disabled={fieldLocked}
                      onChange={(value) => onChangePlatformChannel({ platform: value })}
                    />
                  </label>
                  <label>
                    <span className="contract-recognition-label">频道链接</span>
                    <input
                      aria-label="频道链接"
                      value={channelUrl}
                      placeholder="待补充"
                      readOnly={fieldLocked}
                      onChange={(event) => onChangePlatformChannel({ channelUrl: event.target.value })}
                    />
                  </label>
                  <div className="contract-recognition-platform-channel-meta">{fieldMetadata}</div>
                </div>
              ) : (
                <>
                  <div className="contract-recognition-label">{fieldLabels[field.fieldKey] ?? field.label}</div>
                  <div className="contract-recognition-value">
                {field.fieldKey === 'signatureStatus' ? (
                  <select
                    aria-label={fieldLabels[field.fieldKey] ?? field.label}
                    value={signatureValue}
                    disabled={fieldLocked}
                    onChange={(event) => onChange(field.fieldKey, event.target.value)}
                  >
                    <option value="">待确认</option>
                    <option value="SIGNED">已签署</option>
                    <option value="UNSIGNED">未签署</option>
                  </select>
                ) : field.fieldKey === 'contractExpiry' ? (
                  <div className={`contract-expiry-editor${expiryError ? ' is-error' : ''}`}>
                    <label>
                      <span>开始日期</span>
                      <input
                        aria-label="合同有效期开始日期"
                        type="date"
                        value={expiryStartDate}
                        disabled={fieldLocked}
                        aria-invalid={Boolean(expiryError)}
                        onChange={(event) => onChangeExpiry(event.target.value, expiryDate)}
                      />
                    </label>
                    <span className="contract-expiry-separator" aria-hidden="true">至</span>
                    <label>
                      <span>结束日期</span>
                      <input
                        aria-label="合同有效期结束日期"
                        type="date"
                        value={expiryDate}
                        disabled={fieldLocked}
                        aria-invalid={Boolean(expiryError)}
                        onChange={(event) => onChangeExpiry(expiryStartDate, event.target.value)}
                      />
                    </label>
                    {expiryError ? <small className="contract-expiry-error" role="alert">{expiryError}</small> : null}
                  </div>
                ) : (
                  <input
                    aria-label={fieldLabels[field.fieldKey] ?? field.label}
                    value={recognitionFieldDisplayValue(field)}
                    placeholder="待补充"
                    readOnly={fieldLocked}
                    onChange={(event) => onChange(field.fieldKey, event.target.value)}
                  />
                )}
                    {fieldMetadata}
                  </div>
                </>
              )}
              <div className="contract-recognition-actions">
                <span className="contract-recognition-status">{field.readOnly ? '系统生成' : FIELD_STATUS_LABELS[field.status]}</span>
              </div>
            </article>
          </Fragment>
        );
      })}
    </div>
  );
}

export function ContractDetailPage({
  contract,
  contracts = [],
  projects = [],
  projectDirectory = projects,
  creators = [],
  requestProjects = [],
  onBack,
  backLabel = '返回合同列表',
  notify,
  onUpdateContract,
  canEditTemplate = false,
  canEdit = true,
  onBindFrameworkContract,
  onUploadContracts,
  onTemplateDirtyChange,
  signatureSender = simulateDocuSignContractSend,
}: {
  contract: ContractRecord;
  contracts?: ContractRecord[];
  projects?: ProjectSummary[];
  projectDirectory?: ProjectSummary[];
  creators?: CreatorProfile[];
  requestProjects?: PaymentRequestProjectLike[];
  onBack: () => void;
  backLabel?: string;
  notify: Notify;
  onUpdateContract?: (contract: ContractRecord) => void;
  canEditTemplate?: boolean;
  canEdit?: boolean;
  onBindFrameworkContract?: (ioContractId: ContractId, frameworkContractId?: ContractId) => boolean;
  onUploadContracts?: (inputs: ContractUploadInput[]) => ContractRecord[];
  onTemplateDirtyChange?: (dirty: boolean) => void;
  signatureSender?: ContractSignatureSender;
}) {
  const [activeTab, setActiveTab] = useState<ContractDetailTab>('summary');
  const [dismissedDocumentNoteId, setDismissedDocumentNoteId] = useState<string | null>(null);
  const [draftFields, setDraftFields] = useState(() => (
    normalizeContractRecognitionFields(contract.recognitionResults ?? [])
  ));
  const [activeDocumentId, setActiveDocumentId] = useState(contract.sourceDocuments?.[0]?.id ?? '');
  const [focusedSource, setFocusedSource] = useState<ContractSourceLocation | null>(null);
  const [frameworkUploadOpen, setFrameworkUploadOpen] = useState(false);
  const [generatedUploadOpen, setGeneratedUploadOpen] = useState(false);
  const [templateEditorDirty, setTemplateEditorDirty] = useState(false);
  const [templateDeactivateConfirmationOpen, setTemplateDeactivateConfirmationOpen] = useState(false);
  const [templateStatusValidationIssues, setTemplateStatusValidationIssues] = useState<ContractTemplatePolicyIssue[]>([]);
  const [signatureConfirmationOpen, setSignatureConfirmationOpen] = useState(false);
  const [signatureSignerName, setSignatureSignerName] = useState('');
  const [signatureSendError, setSignatureSendError] = useState('');
  const [signatureSending, setSignatureSending] = useState(false);
  useEffect(() => {
    setDraftFields(normalizeContractRecognitionFields(contract.recognitionResults ?? []));
    setActiveDocumentId(contract.sourceDocuments?.[0]?.id ?? '');
    setFocusedSource(null);
    setSignatureConfirmationOpen(false);
    setSignatureSignerName('');
    setSignatureSendError('');
    setSignatureSending(false);
  }, [contract.id]);
  useEffect(() => {
    if (!templateEditorDirty) return undefined;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [templateEditorDirty]);
  const selectedDocument = useMemo(() => (
    contract.sourceDocuments?.find((document) => document.id === activeDocumentId)
    ?? contract.sourceDocuments?.[0]
  ), [activeDocumentId, contract.sourceDocuments]);
  const sourceName = selectedDocument?.fileName ?? contract.sourceName;
  const documentUrl = selectedDocument?.documentUrl ?? contract.documentUrl;
  const pageCount = selectedDocument?.pageCount ?? contract.pageCount;
  const isPdf = /\.pdf$/i.test(sourceName);
  const previewPage = focusedSource && focusedSource.documentId === selectedDocument?.id
    ? focusedSource.pageNumber
    : null;
  const previewUrl = `${documentUrl}#page=${previewPage ?? 1}&toolbar=1&navpanes=0&view=FitH`;
  const contractType = getContractType(contract);
  const summaryFields = SUMMARY_FIELDS_BY_TYPE[contractType];
  const paymentFields = PAYMENT_FIELDS_BY_TYPE[contractType];
  const usesModernUploadRecognition = draftFields.some((field) => (
    field.fieldKey === 'signatureStatus'
    || field.fieldKey === 'contractExpiry'
    || CONTRACT_UPLOAD_BANK_FIELD_KEYS.includes(field.fieldKey)
    || CONTRACT_UPLOAD_PAYPAL_FIELD_KEYS.includes(field.fieldKey)
  ));
  const presentRecognitionKeys = new Set(
    draftFields.filter((field) => field.applicable !== false).map((field) => field.fieldKey),
  );
  const hasBankRecognitionFields = draftFields.some((field) => field.group === 'bank');
  const hasPaypalRecognitionFields = draftFields.some((field) => field.group === 'paypal');
  const hasDetectedAccountEvidence = draftFields.some((field) => (
    (field.group === 'bank' || field.group === 'paypal')
    && field.candidates.length > 0
  ));
  const bankRecognitionApplicable = draftFields.some((field) => field.group === 'bank' && field.applicable !== false);
  const paypalRecognitionApplicable = draftFields.some((field) => field.group === 'paypal' && field.applicable !== false);
  const accountRecognitionMode = bankRecognitionApplicable && paypalRecognitionApplicable
    ? 'MIXED'
    : bankRecognitionApplicable
      ? 'BANK'
      : paypalRecognitionApplicable
        ? 'PAYPAL'
        : '';
  const modernSummaryFieldKeys: ContractFieldKey[] = [
    'advertiser',
    'publisher',
    'signatureStatus',
    'contractExpiry',
    'platformChannel',
    ...(contractType === 'IO' ? ['ioNumber' as const] : []),
    'contractNumber',
  ];
  const modernPaymentFieldKeys: ContractFieldKey[] = [
    'projectTotalFees',
    'transferFee',
    ...CONTRACT_UPLOAD_BANK_FIELD_KEYS,
    ...CONTRACT_UPLOAD_PAYPAL_FIELD_KEYS,
  ];
  const summaryFieldKeys: ContractFieldKey[] = usesModernUploadRecognition
    ? modernSummaryFieldKeys.filter((fieldKey) => presentRecognitionKeys.has(fieldKey))
    : summaryFields.map((field) => field.key).filter(isRecognitionFieldKey);
  const paymentFieldKeys: ContractFieldKey[] = usesModernUploadRecognition
    ? modernPaymentFieldKeys.filter((fieldKey) => presentRecognitionKeys.has(fieldKey))
    : paymentFields.map((field) => field.key).filter(isRecognitionFieldKey);
  const recognitionFieldKeys = Array.from(new Set([...summaryFieldKeys, ...paymentFieldKeys]));
  const recognitionKeysToConfirm = (fieldKeys: readonly ContractFieldKey[]) => (
    contractRecognitionKeysToConfirm(draftFields, fieldKeys)
  );
  const requiredRecognitionFieldKeys = recognitionKeysToConfirm(recognitionFieldKeys);
  const projectName = useMemo(() => {
    const projectId = contract.cooperationProjectId ?? contract.projectId;
    const mapped = projectId
      ? projectDirectory.find((project) => (
        String(project.cooperationProjectId ?? project.projectId ?? project.id) === String(projectId)
        || String(project.id) === String(projectId)
      ))
      : undefined;
    return mapped?.name || contract.project || '待关联项目';
  }, [contract.cooperationProjectId, contract.project, contract.projectId, projectDirectory]);
  const creator = creators.find((candidate) => candidate.id === contract.creatorId)
    ?? creators.find((candidate) => candidate.name === contract.publisher);
  const fallbackPaymentSnapshot = creator
    ? invoicePaymentForCreator(creator, contract.payoutProvider ?? 'Airwallex')
    : createDemoAirwallexSnapshot(contract);
  const paymentSnapshot = contract.paymentSnapshot
    ?? contract.generationSnapshot?.paymentSnapshot
    ?? fallbackPaymentSnapshot;
  const hasRecognition = draftFields.length > 0;
  const applicableRecognitionFields = requiredRecognitionFieldKeys
    .map((fieldKey) => draftFields.find((field) => field.fieldKey === fieldKey))
    .filter((field): field is ContractRecognitionField => Boolean(field));
  const confirmedCount = applicableRecognitionFields.filter((field) => field.status === 'confirmed').length;
  const allConfirmed = hasRecognition
    && applicableRecognitionFields.length > 0
    && confirmedCount === applicableRecognitionFields.length;
  const draftSignatureField = draftFields.find((field) => field.fieldKey === 'signatureStatus');
  const draftSignatureValue = draftSignatureField?.normalizedValue
    && typeof draftSignatureField.normalizedValue === 'object'
    ? draftSignatureField.normalizedValue as { signed?: boolean }
    : null;
  const draftSignatureConfirmed = draftSignatureField?.status === 'confirmed';
  const draftSignatureSigned = draftSignatureConfirmed && draftSignatureValue?.signed === true;
  const draftSignatureUnsigned = draftSignatureConfirmed && draftSignatureValue?.signed === false;
  const confirmedRecognitionDraft = allConfirmed
    ? projectConfirmedRecognitionDraft(
        { ...contract, recognitionResults: draftFields },
        requiredRecognitionFieldKeys,
      )
    : null;
  const signatureSourceContract = confirmedRecognitionDraft ?? contract;
  const signaturePaymentInformation = contractSignaturePaymentInformationFor(
    signatureSourceContract,
    paymentSnapshot,
  );
  const recognitionApplied = contract.extractionStage === 'applied';
  const nonSignatureIssues = contract.issues.filter((issue) => issue.id !== 'signature');
  const visibleIssues = allConfirmed
    ? nonSignatureIssues.filter((issue) => issue.id !== 'recognition-review')
    : nonSignatureIssues;
  const readiness = getContractReadiness({ ...contract, issues: visibleIssues });
  const templateReadiness = getContractTemplatePolicyReadiness(contract.templateFieldPolicies);
  const templateStatus = getContractTemplateStatus(contract);
  const validity = getContractValidity(contract);
  const paymentReady = readiness.ready && !validity.expired;
  const readinessLabel = validity.expired ? '已失效' : readiness.label;
  const signatureConfirmed = contract.signed === true
    || (contract.signed == null && contract.lifecycle === 'CONFIRMED');
  const effectiveSignatureConfirmed = signatureConfirmed || (!recognitionApplied && draftSignatureSigned);
  const signaturePending = !contract.isTemplate && !effectiveSignatureConfirmed;
  const checkIssueCount = visibleIssues.length + (signaturePending ? 1 : 0);
  const recognitionPageState = (fieldKeys: readonly ContractFieldKey[]) => {
    const pageFieldKeys = recognitionKeysToConfirm(fieldKeys);
    const pageFields = pageFieldKeys
      .map((fieldKey) => draftFields.find((field) => field.fieldKey === fieldKey))
      .filter((field): field is ContractRecognitionField => Boolean(field));
    return {
      confirmedCount: pageFields.filter((field) => field.status === 'confirmed').length,
      fieldCount: pageFields.length,
      allConfirmed: pageFields.length > 0 && pageFields.every((field) => field.status === 'confirmed'),
      canConfirm: canConfirmRecognitionFields(draftFields, pageFieldKeys),
    };
  };
  const summaryPageState = recognitionPageState(summaryFieldKeys);
  const paymentPageState = recognitionPageState(paymentFieldKeys);
  const tabs: Array<{ id: ContractDetailTab; label: string }> = [
    { id: 'summary', label: '合同摘要' },
    { id: 'payment', label: '付款与Invoice' },
    { id: 'checks', label: `校验记录${checkIssueCount ? ` ${checkIssueCount}` : ''}` },
  ];
  const canEditCurrentContract = canEdit && (!contract.isTemplate || canEditTemplate);
  const isConfirmedUnsignedUpload = allConfirmed
    && draftSignatureUnsigned
    && contract.lifecycle === 'UPLOADED_PENDING_CONFIRMATION'
    && contract.extractionStage === 'confirmed';
  const isLegacyAppliedUnsignedContract = contract.lifecycle === 'RECOGNITION_CONFIRMED'
    && contract.extractionStage === 'applied'
    && !contract.signed;
  const canOpenSignatureConfirmation = (isConfirmedUnsignedUpload || isLegacyAppliedUnsignedContract)
    && canEditCurrentContract
    && Boolean(onUpdateContract);
  const applyRecognitionDisabledReason = !canEditCurrentContract
    ? '当前账号没有编辑合同资料的权限。'
    : !onUpdateContract
      ? '当前合同无法更新。'
      : !allConfirmed
        ? '请先确认全部识别字段。'
        : draftSignatureUnsigned
          ? '合同尚未签署，请先发送达人签署并等待完成。'
          : !draftSignatureSigned
            ? '请先确认合同签署状态。'
            : undefined;
  const pendingGeneratedUpload = Boolean(
    contract.uploadedFromDraftId
    && contract.lifecycle === 'UPLOADED_PENDING_CONFIRMATION',
  );
  const frameworkContracts = contracts.filter((candidate) => (
    isFrameworkContract(candidate)
    && candidate.contractId
    && candidate.creatorId === contract.creatorId
    && candidate.contractId !== contract.contractId
  ));
  const linkedIoContracts = isFrameworkContract(contract)
    ? frameworkIoContracts(contract, contracts)
    : [];
  const contractIds = new Set(
    [contract.contractId, contract.id].filter((value): value is string => Boolean(value)),
  );
  const linkedRequestCount = new Set(requestProjects
    .filter((request) => request.creatorLinks?.some((link) => (
      link.contractIds.some((contractId) => contractIds.has(contractId))
    )))
    .map((request) => request.paymentRequestProjectId ?? request.id)).size;
  const frameworkRelationOptions = [
    { value: '', label: '不绑定框架合同', description: 'IO 单保存后仍可用于 Invoice 与付款流程' },
    ...frameworkContracts.map((candidate) => ({
      value: candidate.contractId!,
      label: `${candidate.id} · ${candidate.name}`,
      description: `${candidate.project} · ${CONTRACT_TYPE_LABELS.FRAMEWORK}`,
    })),
  ];
  const uploadedByUser = contract.uploadedByAccount
    ? resolveSystemUser(contract.uploadedByAccount)
    : undefined;
  const uploaderName = uploadedByUser?.name ?? contract.uploadedByAccount ?? '系统内置';
  const uploaderDetail = uploadedByUser
    ? uploadedByUser.account
    : contract.uploadedByAccount
      ? '账号未收录在当前用户目录'
      : '随系统发布';

  const templateStatusDisabledReason = !canEditCurrentContract
    ? '当前账号没有模板编辑权限。'
    : !onUpdateContract
      ? '当前模板无法更新。'
      : templateEditorDirty
        ? '请先保存字段配置，再更改模板状态。'
        : undefined;

  const updateTemplateStatus = (status: 'ACTIVE' | 'INACTIVE') => {
    if (!contract.isTemplate || templateStatusDisabledReason || !onUpdateContract) return;
    const result = createContractTemplateStatusUpdate(contract, status);
    if (!result.contract) {
      setTemplateStatusValidationIssues(result.issues);
      notify('模板无法启动', result.issues[0]?.message ?? '请先修复字段配置中的阻断项。');
      return;
    }
    onUpdateContract(result.contract);
    setTemplateStatusValidationIssues([]);
    setTemplateDeactivateConfirmationOpen(false);
    notify(
      status === 'ACTIVE' ? '模板已启动' : '模板已停用',
      status === 'ACTIVE'
        ? '新建合同现在可以使用这份模板。'
        : '模板已停止用于新建合同，既有草稿和历史合同不受影响。',
    );
  };

  const leaveDetail = () => {
    if (contract.isTemplate && templateEditorDirty) {
      const shouldLeave = window.confirm('合同模板配置尚未保存，确定要离开吗？');
      if (!shouldLeave) return;
    }
    onBack();
  };

  const copyContractId = async () => {
    await navigator.clipboard.writeText(contract.id);
    notify('合同编号已复制', contract.id);
  };

  const updateField = (fieldKey: ContractFieldKey, value: string) => {
    if (!canEditCurrentContract || contract.lifecycle === 'SENT_FOR_SIGNATURE') return;
    setDraftFields((current) => current.map((field) => (
      field.fieldKey === fieldKey ? editRecognitionField(field, value) : field
    )));
  };

  const updateContractExpiry = (startDate: string, endDate: string) => {
    if (!canEditCurrentContract || contract.lifecycle === 'SENT_FOR_SIGNATURE') return;
    setDraftFields((current) => current.map((field) => (
      field.fieldKey === 'contractExpiry'
        ? editContractExpiryRange(field, startDate, endDate)
        : field
    )));
  };

  const updatePlatformChannel = (patch: { platform?: string; channelUrl?: string }) => {
    if (!canEditCurrentContract || contract.lifecycle === 'SENT_FOR_SIGNATURE') return;
    setDraftFields((current) => current.map((field) => (
      field.fieldKey === 'platformChannel'
        ? editPlatformChannelRecognitionField(field, patch)
        : field
    )));
  };

  const updateAccountRecognitionMode = (mode: string) => {
    if (!canEditCurrentContract || recognitionApplied || contract.lifecycle === 'SENT_FOR_SIGNATURE') return;
    const next = draftFields.map((field) => {
      if (field.group === 'bank') return { ...field, applicable: mode === 'BANK' || mode === 'MIXED' };
      if (field.group === 'paypal') return { ...field, applicable: mode === 'PAYPAL' || mode === 'MIXED' };
      return field;
    });
    setDraftFields(next);
    onUpdateContract?.({
      ...contract,
      recognitionResults: next,
      extractionStage: 'review',
    });
  };

  const confirmPage = (fieldKeys: readonly ContractFieldKey[], pageLabel: string) => {
    if (!canEditCurrentContract) return;
    if (recognitionApplied || contract.lifecycle === 'SENT_FOR_SIGNATURE') return;
    const fieldsToConfirm = recognitionKeysToConfirm(fieldKeys);
    if (!canConfirmRecognitionFields(draftFields, fieldsToConfirm)) {
      notify('本页仍有待处理字段', `${pageLabel}存在待补充或需核对字段，请处理后再确认。`);
      return;
    }
    const next = confirmRecognitionFields(draftFields, fieldsToConfirm);
    setDraftFields(next);
    onUpdateContract?.({
      ...contract,
      recognitionResults: next,
      extractionStage: requiredRecognitionFieldKeys.every((fieldKey) => (
        next.some((field) => field.fieldKey === fieldKey && field.status === 'confirmed')
      )) ? 'confirmed' : 'review',
    });
    notify('本页字段已确认', `${pageLabel}的字段信息已统一确认。`);
  };

  const editPage = (fieldKeys: readonly ContractFieldKey[], pageLabel: string) => {
    if (!canEditCurrentContract) return;
    if (recognitionApplied || contract.lifecycle === 'SENT_FOR_SIGNATURE') return;
    const next = reopenRecognitionFields(draftFields, fieldKeys);
    setDraftFields(next);
    onUpdateContract?.({
      ...contract,
      recognitionResults: next,
      extractionStage: 'review',
    });
    notify('本页已进入编辑状态', `${pageLabel}字段修改后需要重新确认。`);
  };

  const renderPageAction = (
    fieldKeys: readonly ContractFieldKey[],
    pageLabel: string,
    pageState: { allConfirmed: boolean; canConfirm: boolean },
  ) => {
    if (!hasRecognition || !onUpdateContract) return null;
    if (!canEditCurrentContract) {
      return <span className="contract-page-readonly">仅允许媒介负责人、老板或管理员编辑</span>;
    }
    if (contract.lifecycle === 'SENT_FOR_SIGNATURE') {
      return <span className="contract-page-readonly">已发送签署，字段已锁定</span>;
    }
    if (pageState.allConfirmed) {
      return recognitionApplied ? (
        <span className="contract-page-applied">
          <CheckCircle2 size={14} />
          已应用
        </span>
      ) : (
        <button
          className="contract-page-confirm contract-page-edit"
          type="button"
          onClick={() => editPage(fieldKeys, pageLabel)}
        >
          <Pencil size={14} />
          编辑
        </button>
      );
    }
    return (
      <button
        className="contract-page-confirm"
        type="button"
        disabled={!pageState.canConfirm}
        onClick={() => confirmPage(fieldKeys, pageLabel)}
      >
        <CheckCircle2 size={14} />
        确认本页
      </button>
    );
  };

  const selectCandidate = (fieldKey: ContractFieldKey, candidate: ContractFieldCandidate) => {
    if (!canEditCurrentContract || contract.lifecycle === 'SENT_FOR_SIGNATURE') return;
    setDraftFields((current) => current.map((field) => field.fieldKey === fieldKey
      ? {
          ...field,
          rawValue: candidate.rawValue,
          normalizedValue: candidate.normalizedValue,
          source: candidate.source,
          confidence: candidate.confidence,
          status: fieldKey === 'contractExpiry' && !isContractExpiryRangeValid(candidate.normalizedValue)
            ? 'missing'
            : 'detected',
        }
      : field));
    setActiveDocumentId(candidate.source.documentId);
    setFocusedSource(candidate.source);
  };

  const openSource = (source: ContractSourceLocation) => {
    if (source.documentId !== 'system-contract') setActiveDocumentId(source.documentId);
    setFocusedSource(source);
  };

  const applyRecognition = () => {
    if (!canEditCurrentContract) {
      notify('暂无模板编辑权限', '仅媒介负责人、老板或管理员可以修改合同模板。');
      return;
    }
    if (!allConfirmed) {
      notify('仍有字段未确认', `已确认 ${confirmedCount}/${applicableRecognitionFields.length} 项，请完成适用字段确认。`);
      return;
    }
    if (!draftSignatureSigned) {
      notify(
        draftSignatureUnsigned ? '合同尚未签署' : '签署状态未确认',
        draftSignatureUnsigned
          ? '合同尚未签署，请先发送达人签署并等待完成。'
          : '请先确认合同签署状态。',
      );
      return;
    }
    const candidate = { ...contract, recognitionResults: draftFields };
    const applied = applyConfirmedRecognitionToContract(candidate, requiredRecognitionFieldKeys);
    if (!applied) {
      notify('仍有字段未确认', `已确认 ${confirmedCount}/${applicableRecognitionFields.length} 项，请完成适用字段确认。`);
      return;
    }
    onUpdateContract?.(applied);
    notify(
      '合同资料已确认',
      applied.signed
        ? '上传文件和结构化字段已应用，合同已按确认的签署状态完成归档。'
        : '上传文件和结构化字段已应用，可以发送给 C 端达人签署。',
    );
  };

  const openSignatureConfirmation = () => {
    if (!canOpenSignatureConfirmation) return;
    setSignatureSignerName(signatureSourceContract.publisher || creator?.name || '');
    setSignatureSendError('');
    setSignatureConfirmationOpen(true);
  };

  const closeSignatureConfirmation = () => {
    if (signatureSending) return;
    setSignatureConfirmationOpen(false);
    setSignatureSendError('');
  };

  const sendForSignature = async () => {
    if (!canEditCurrentContract || !onUpdateContract || signatureSending) return;
    const signerName = signatureSignerName.trim();
    if (!signerName) {
      setSignatureSendError('请填写签署人。');
      return;
    }
    setSignatureSending(true);
    setSignatureSendError('');
    const request = createContractSignatureRequest(signatureSourceContract, {
      creatorDisplayName: creator?.name || signatureSourceContract.publisher || '待补充',
      amount: formatContractMoney(signatureSourceContract),
      paymentInformation: signaturePaymentInformation,
      signerName,
      requestedAt: new Date().toISOString(),
    });
    try {
      const result = await sendContractSignatureRequest(request, signatureSender);
      if (!result.ok) {
        setSignatureSendError(result.error);
        notify('发送签署失败', result.error);
        return;
      }
      const sent = sendContractForSignature({
        ...contract,
        recognitionResults: draftFields,
        extractionStage: recognitionApplied ? contract.extractionStage : 'confirmed',
      }, request, result);
      if (!sent) {
        const reason = '请先确认两页字段，并将签署状态选择为未签署。';
        setSignatureSendError(reason);
        notify('无法发送合同', reason);
        return;
      }
      onUpdateContract(sent);
      setSignatureConfirmationOpen(false);
      notify('已发送达人签署', `${contract.id} 已进入待签署，当前为前端原型模拟 DocuSign 通知。`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '签署通知发送失败，请稍后重试。';
      setSignatureSendError(message);
      notify('发送签署失败', message);
    } finally {
      setSignatureSending(false);
    }
  };

  const completeSignature = () => {
    if (!canEditCurrentContract || !onUpdateContract) return;
    const completed = completeContractSignature(contract, new Date().toISOString(), requiredRecognitionFieldKeys);
    if (!completed) {
      notify('无法完成签署', '请确认合同仍处于待签署状态，且发送前冻结的识别字段完整有效。');
      return;
    }
    onUpdateContract(completed);
    notify('达人签署已完成', `${contract.id} 已回写签署时间，并按合同完整性重新计算付款就绪度。`);
  };

  const updateFrameworkRelation = (value: string) => {
    if (!onBindFrameworkContract || !contract.contractId) return;
    const nextId = value ? value as ContractId : undefined;
    if (onBindFrameworkContract(contract.contractId, nextId)) {
      notify(
        nextId ? '框架合同已绑定' : '框架合同关系已解除',
        nextId ? 'IO 单已关联所选框架合同，可在框架合同详情查看子单。' : 'IO 单仍可独立参与 Invoice 与付款流程。',
      );
    }
  };

  const saveFrameworkUpload = (inputs: ContractUploadInput[]) => {
    if (!onUploadContracts || !contract.contractId) return;
    const records = onUploadContracts(inputs);
    const framework = records.find((record) => isFrameworkContract(record));
    if (!framework?.contractId || !onBindFrameworkContract) {
      setFrameworkUploadOpen(false);
      notify('框架合同已保存', '框架合同已保存，稍后可从 IO 单详情中选择绑定。');
      return;
    }
    onBindFrameworkContract(contract.contractId, framework.contractId);
    setFrameworkUploadOpen(false);
    notify('框架合同已上传并绑定', `${framework.id} 已成为当前 IO 单的框架合同。`);
  };

  const saveGeneratedUpload = (inputs: ContractUploadInput[]) => {
    if (!onUploadContracts) return;
    const records = onUploadContracts(inputs);
    setGeneratedUploadOpen(false);
    notify('合同文件已上传', `${records[0]?.name ?? contract.name} 已进入识别信息确认流程。`);
  };

  return (
    <div className={`page-stack contract-detail-page${contract.isTemplate ? ' contract-template-detail-page' : ''}`}>
      <button className="project-back-button" type="button" onClick={leaveDetail}>
        <ArrowLeft size={17} />
        {backLabel}
      </button>

      <PageHeading
        title={contract.name}
        subtitle={`${contract.id} · ${projectName}`}
        actions={(
          <>
            {contract.isTemplate ? (
              <Button
                variant={templateStatus === 'ACTIVE' ? 'danger' : 'secondary'}
                icon={templateStatus === 'ACTIVE' ? <PowerOff size={16} /> : <Power size={16} />}
                disabled={Boolean(templateStatusDisabledReason)}
                disabledReason={templateStatusDisabledReason}
                onClick={() => {
                  if (templateStatus === 'ACTIVE') setTemplateDeactivateConfirmationOpen(true);
                  else updateTemplateStatus('ACTIVE');
                }}
              >
                {templateStatus === 'ACTIVE' ? '停用模板' : '启动模板'}
              </Button>
            ) : <Button variant="secondary" icon={<Clipboard size={16} />} onClick={copyContractId}>复制编号</Button>}
            {!contract.isTemplate && documentUrl ? (
              <a
                className="button button-primary contract-file-action"
                href={documentUrl}
                download={contractDocumentFilename(contract)}
              >
                <Download size={16} />
                <span>下载当前文件</span>
              </a>
            ) : null}
          </>
        )}
      />

      {contract.isTemplate ? (
        <div className="contract-metric-grid contract-template-metric-grid">
          <article>
            <span>合同类型</span>
            <strong>{CONTRACT_TYPE_LABELS[contractType]}</strong>
            <small>模板详情只读展示当前合同结构</small>
          </article>
          <article>
            <span>使用就绪度</span>
            <strong className={templateReadiness.ready ? 'contract-ready-text' : 'contract-attention-text'}>{templateReadiness.label}</strong>
            <small>{templateReadiness.ready ? '字段策略校验通过，可用于合同生成' : `${templateReadiness.blockers.length} 项策略会阻止正式生成`}</small>
          </article>
          <article>
            <span>上传者</span>
            <strong>{uploaderName}</strong>
            <small>{uploaderDetail}</small>
          </article>
          <article>
            <span>签署状态</span>
            <strong>{contractSignatureStatusLabel(contract)}</strong>
            <small>合同模板不参与签署流程</small>
          </article>
        </div>
      ) : (
        <div className="contract-metric-grid">
          <article>
            <span>付款就绪度</span>
            <strong className={paymentReady ? 'contract-ready-text' : 'contract-attention-text'}>{readinessLabel}</strong>
            <small>{isFrameworkContract(contract)
              ? paymentReady ? '可供同一达人 IO 单选择绑定' : validity.expired ? '合同已到期，仅保留历史关系' : '确认主体和签署状态后可用于绑定'
              : paymentReady ? '可加入新建付款项目' : validity.expired ? '合同已到期，不能建立新的付款关联' : '完成阻断项后才能进入付款流程'}</small>
          </article>
          <article>
            <span>合同金额</span>
            <strong>{isFrameworkContract(contract) ? '——' : formatContractMoney(contract)}</strong>
            <small>{hasRecognition && contract.extractionStage !== 'applied' ? '识别结果尚未应用到正式字段' : '以人工确认后的正式字段为准'}</small>
          </article>
          <article>
            <span>关联请款项目</span>
            <strong>{`${linkedRequestCount} 个`}</strong>
            <small>{linkedRequestCount ? '按稳定合同 ID 统计当前已关联请款' : '当前合同尚未关联请款项目'}</small>
          </article>
        </div>
      )}

      {!contract.isTemplate ? <section className={`contract-relationship-panel contract-relationship-${contractType.toLowerCase()}`}>
        <header>
          <span className="contract-relationship-icon"><Link2 size={17} /></span>
          <div>
            <strong>合同关系</strong>
            <small>{CONTRACT_TYPE_LABELS[contractType]} · {isFrameworkContract(contract) ? '一个框架合同可关联多个 IO 单' : '关系调整会记录到项目工作流'}</small>
          </div>
          <span className={`contract-type-badge contract-type-${contractType.toLowerCase()}`}>{CONTRACT_TYPE_LABELS[contractType]}</span>
        </header>
        {isFrameworkContract(contract) ? (
          <div className="contract-relationship-content">
            <div className="contract-relationship-summary"><strong>{linkedIoContracts.length}</strong><span>个已绑定 IO 单</span></div>
            {linkedIoContracts.length ? (
              <div className="contract-child-list">
                {linkedIoContracts.map((child) => (
                  <div key={child.contractId ?? child.id} className="contract-child-item">
                    <span><strong>{child.id}</strong><small>{child.name}</small></span>
                    <span className="contract-type-badge contract-type-io">IO 单</span>
                  </div>
                ))}
              </div>
            ) : <div className="contract-inline-empty">当前框架合同尚未绑定 IO 单。</div>}
          </div>
        ) : isIoContract(contract) ? (
          <div className="contract-relationship-content contract-io-relation-content">
            <div className="contract-relationship-field">
              <span>框架合同</span>
              {onBindFrameworkContract && contract.contractId ? (
                <SelectField
                  ariaLabel="框架合同"
                  variant="form"
                  value={contract.frameworkContractId ?? ''}
                  options={frameworkRelationOptions}
                  onChange={updateFrameworkRelation}
                />
              ) : <strong>{contract.frameworkContractId ?? '待绑定框架合同'}</strong>}
              <small>{contract.frameworkContractId ? '已绑定，可随时更换或解除' : '未绑定不影响保存、确认、Invoice 和付款流程'}</small>
            </div>
            {onUploadContracts && onBindFrameworkContract ? (
              <Button variant="secondary" icon={<Upload size={15} />} onClick={() => setFrameworkUploadOpen(true)}>上传并绑定框架合同</Button>
            ) : null}
            {contract.frameworkContractId ? (
              <button className="contract-unlink-action" type="button" onClick={() => updateFrameworkRelation('')}>
                <Unlink size={14} />解除绑定
              </button>
            ) : null}
          </div>
        ) : (
          <div className="contract-relationship-content"><span className="contract-relationship-independent"><ShieldCheck size={16} />独立合同不需要框架合同关系。</span></div>
        )}
      </section> : null}

      {contract.documentNote && dismissedDocumentNoteId !== contract.id ? (
        <div className="contract-document-note" role="note">
          <FileSearch size={17} />
          <span>{contract.documentNote}</span>
          <button className="icon-button contract-document-note-close" type="button" aria-label="关闭合同预览提示" onClick={() => setDismissedDocumentNoteId(contract.id)}>
            <X size={17} />
          </button>
        </div>
      ) : null}

      <div className="contract-reader-layout">
        <section className="contract-document-panel">
          <header>
            <div>
              <FileText size={19} />
              <span><strong>合同全文</strong><small>{sourceName}{pageCount ? ` · ${pageCount}页` : ''}</small></span>
            </div>
            {documentUrl ? <a href={documentUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />新窗口打开</a> : null}
          </header>
          {contract.sourceDocuments && contract.sourceDocuments.length > 1 ? (
            <div className="contract-document-switcher" role="tablist" aria-label="合同文件">
              {contract.sourceDocuments.map((document) => (
                <button
                  className={selectedDocument?.id === document.id ? 'active' : ''}
                  type="button"
                  role="tab"
                  aria-selected={selectedDocument?.id === document.id}
                  key={document.id}
                  onClick={() => { setActiveDocumentId(document.id); setFocusedSource(null); }}
                >
                  {document.fileName}
                </button>
              ))}
            </div>
          ) : null}
          {documentUrl && isPdf ? (
            <iframe className="contract-pdf-frame" src={previewUrl} title={`${contract.name} PDF原文`} />
          ) : documentUrl && selectedDocument ? (
            <div className="contract-document-canvas contract-document-download-only">
              <FileText size={32} />
              {focusedSource?.documentId === selectedDocument.id ? (
                <>
                  <strong>{focusedSource.section || 'DOCX 原文位置'}</strong>
                  <p className="contract-docx-source-text">{focusedSource.sourceText}</p>
                </>
              ) : (
                <>
                  <strong>DOCX 已在浏览器本地解析</strong>
                  <p>点击右侧字段来源可查看对应章节和原文；完整排版请下载原文件查看。</p>
                </>
              )}
            </div>
          ) : (
            <div className="contract-document-canvas">
              <ContractDocumentView contract={contract} ariaLabel={`${contract.id} 合同全文`} />
            </div>
          )}
        </section>

        <section className={`contract-inspector${contract.isTemplate ? ' contract-template-inspector' : ''}`}>
          {contract.isTemplate ? (
            <ContractTemplateFieldEditor
              contract={contract}
              canEdit={canEditCurrentContract}
              onSave={onUpdateContract}
              onDirtyChange={(dirty) => {
                setTemplateEditorDirty(dirty);
                if (dirty) setTemplateStatusValidationIssues([]);
                onTemplateDirtyChange?.(dirty);
              }}
              validationIssues={templateStatusValidationIssues}
              notify={notify}
            />
          ) : (
            <>
          <div className="contract-tabs" role="tablist" aria-label="合同详情分类">
            {tabs.map((tab) => (
              <button className={activeTab === tab.id ? 'contract-tab-active' : ''} type="button" role="tab" aria-selected={activeTab === tab.id} key={tab.id} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="contract-inspector-content">
            {activeTab === 'summary' ? (
              <>
                <div className="contract-section-heading">
                  <FileSearch size={18} />
                  <span>
                    <strong>结构化合同信息</strong>
                    <small>{hasRecognition ? `本页已确认 ${summaryPageState.confirmedCount}/${summaryPageState.fieldCount} 项` : '每个字段保留合同来源位置'}</small>
                  </span>
                  {renderPageAction(summaryFieldKeys, '合同摘要', summaryPageState)}
                </div>
                {hasRecognition && !recognitionApplied ? (
                  <RecognitionFieldList
                    fields={draftFields}
                    fieldKeys={summaryFieldKeys}
                    onChange={updateField}
                    onChangeExpiry={updateContractExpiry}
                    onChangePlatformChannel={updatePlatformChannel}
                    onSelectCandidate={selectCandidate}
                    onOpenSource={openSource}
                    fieldLabels={usesModernUploadRecognition ? {} : DETAIL_FIELD_LABELS}
                    recognitionLocked={!canEditCurrentContract || contract.lifecycle === 'SENT_FOR_SIGNATURE'}
                  />
                ) : (
                  <ContractDefinitionList
                    contract={contract}
                    fields={summaryFields}
                    projectName={projectName}
                    formalFieldsHidden={contract.lifecycle === 'GENERATED_DRAFT'}
                  />
                )}
              </>
            ) : null}

            {activeTab === 'payment' ? (
              <>
                <div className="contract-section-heading">
                  <ReceiptText size={18} />
                  <span>
                    <strong>付款与Invoice规则</strong>
                    <small>{hasRecognition ? `本页已确认 ${paymentPageState.confirmedCount}/${paymentPageState.fieldCount} 项` : '账户识别值仅用于与达人档案人工比对'}</small>
                  </span>
                  {renderPageAction(paymentFieldKeys, '付款与Invoice', paymentPageState)}
                </div>
                {usesModernUploadRecognition && hasBankRecognitionFields && hasPaypalRecognitionFields && !hasDetectedAccountEvidence && !recognitionApplied ? (
                  <label className="contract-recognition-account-mode">
                    <span>合同账户类型</span>
                    <select
                      aria-label="合同账户类型"
                      value={accountRecognitionMode}
                      disabled={!canEditCurrentContract || contract.lifecycle === 'SENT_FOR_SIGNATURE'}
                      onChange={(event) => updateAccountRecognitionMode(event.target.value)}
                    >
                      <option value="">未识别，请选择</option>
                      <option value="BANK">银行账户</option>
                      <option value="PAYPAL">PayPal</option>
                      <option value="MIXED">银行账户和 PayPal</option>
                    </select>
                    <small>仅用于补充合同识别快照，不会修改达人档案中的付款账户。</small>
                  </label>
                ) : null}
                {pendingGeneratedUpload ? (
                  <div className="contract-generated-payment-snapshot">
                    <div className="contract-generated-payment-snapshot-head">
                      <strong>生成合同付款快照</strong>
                      <small>回传文件人工确认前，以生成合同中的付款与 Invoice 信息为准</small>
                    </div>
                    <ContractPaymentList contract={contract} fields={paymentFields} paymentSnapshot={paymentSnapshot} />
                  </div>
                ) : null}
                {hasRecognition ? (
                  <>
                    {pendingGeneratedUpload ? <div className="contract-recognition-pending-note">以下为上传签署文件的识别结果，完成逐项确认并应用后才会更新正式合同字段。</div> : null}
                    <RecognitionFieldList
                      fields={draftFields}
                      fieldKeys={paymentFieldKeys}
                      onChange={updateField}
                      onChangeExpiry={updateContractExpiry}
                      onChangePlatformChannel={updatePlatformChannel}
                      onSelectCandidate={selectCandidate}
                      onOpenSource={openSource}
                      fieldLabels={usesModernUploadRecognition ? {} : DETAIL_FIELD_LABELS}
                      recognitionLocked={recognitionApplied || !canEditCurrentContract || contract.lifecycle === 'SENT_FOR_SIGNATURE'}
                    />
                  </>
                ) : (
                  <ContractPaymentList contract={contract} fields={paymentFields} paymentSnapshot={paymentSnapshot} />
                )}
                <div className="contract-payment-rule">
                  <Landmark size={17} />
                  <span>合同账户不得自动覆盖达人档案中的已验证 Beneficiary；不一致时必须人工核对。</span>
                </div>
              </>
            ) : null}

            {activeTab === 'checks' ? (
              <>
                <div className="contract-section-heading">
                  <ShieldCheck size={18} />
                  <span><strong>合同完整性检查</strong><small>阻断项未解决时不能加入付款项目</small></span>
                </div>
                {contract.lifecycle === 'GENERATED_DRAFT' ? (
                  <div className="contract-recognition-apply">
                    <span className="contract-recognition-apply-icon"><Upload size={17} /></span>
                    <div><strong>正式合同已生成</strong><small>上传待发送达人的合同文件后进行识别确认</small></div>
                    <Button
                      icon={<Upload size={15} />}
                      disabled={!onUploadContracts || !canEditCurrentContract}
                      disabledReason={!canEditCurrentContract ? '当前账号没有上传合同的权限。' : '当前合同无法上传文件。'}
                      onClick={() => setGeneratedUploadOpen(true)}
                    >上传合同文件</Button>
                  </div>
                ) : null}
                {hasRecognition
                  && contract.extractionStage !== 'applied'
                  && contract.lifecycle !== 'SENT_FOR_SIGNATURE' ? (
                  <div className={`contract-recognition-apply${allConfirmed ? ' contract-recognition-apply-complete' : ''}`}>
                    <span className="contract-recognition-apply-icon">
                      <CheckCircle2 size={17} />
                    </span>
                    <div><strong>人工确认进度</strong><small>{confirmedCount}/{applicableRecognitionFields.length} 项</small></div>
                    <Button
                      disabled={Boolean(applyRecognitionDisabledReason)}
                      disabledReason={applyRecognitionDisabledReason}
                      onClick={applyRecognition}
                    >应用到正式合同资料</Button>
                  </div>
                ) : null}
                {contract.lifecycle === 'SENT_FOR_SIGNATURE' ? (
                  <div className="contract-recognition-apply contract-recognition-apply-complete">
                    <span className="contract-recognition-apply-icon"><FileSignature size={17} /></span>
                    <div>
                      <strong>等待 C 端达人签署</strong>
                      <small>{contract.sentForSignatureAt
                        ? `发送时间：${new Date(contract.sentForSignatureAt).toLocaleString('zh-CN')}`
                        : '已发送达人'}</small>
                    </div>
                    <Button
                      variant="secondary"
                      icon={<CheckCircle2 size={15} />}
                      disabled={!onUpdateContract || !canEditCurrentContract}
                      disabledReason={!canEditCurrentContract ? '当前账号没有更新签署状态的权限。' : '当前合同无法更新。'}
                      onClick={completeSignature}
                    >模拟达人完成签署</Button>
                  </div>
                ) : null}
                <article className={`contract-signature-check${contract.isTemplate ? ' is-not-applicable' : effectiveSignatureConfirmed ? ' is-complete' : ' is-pending'}`}>
                  <span>{contract.isTemplate || effectiveSignatureConfirmed ? <CheckCircle2 size={18} /> : <FileSignature size={18} />}</span>
                  <div>
                    <strong>{contract.isTemplate ? '参考模板无需签署' : effectiveSignatureConfirmed ? '合同已完成签署' : '合同尚未完成签署'}</strong>
                    <p>{contract.isTemplate
                      ? '该记录为参考模板，不参与签署和付款校验。'
                      : effectiveSignatureConfirmed
                        ? '签署状态已确认，可继续进行付款资料校验。'
                        : '请确认双方签署完成；未签署合同不能加入付款项目。'}</p>
                    <small>签署状态</small>
                  </div>
                  {canOpenSignatureConfirmation ? (
                      <Button
                        className="contract-signature-send-action"
                        icon={<FileSignature size={15} />}
                        onClick={openSignatureConfirmation}
                      >发送达人签署</Button>
                    ) : null}
                </article>
                {visibleIssues.length > 0 ? (
                  <div className="contract-issue-list">
                    {visibleIssues.map((issue) => (
                      <article className={`contract-issue contract-issue-${issue.severity}`} key={issue.id}>
                        <span>{issue.severity === 'blocker' ? <AlertTriangle size={17} /> : <FileSearch size={17} />}</span>
                        <div><strong>{issue.label}</strong><p>{issue.description}</p><small>{issue.source}</small></div>
                      </article>
                    ))}
                  </div>
                ) : !signaturePending && paymentReady ? (
                  <div className="contract-check-success">
                    <CheckCircle2 size={22} />
                    <span><strong>关键字段检查通过</strong><small>{isFrameworkContract(contract) ? '框架合同可作为资源，并供同一达人 IO 单绑定。' : '合同可用于新建付款项目，并继续进行Invoice匹配。'}</small></span>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
            </>
          )}
        </section>
      </div>
      {generatedUploadOpen ? (
        <ContractUploadWizard
          projects={projects}
          creators={creators}
          contracts={contracts}
          initialProjectId={(contract.cooperationProjectId ?? contract.projectId ?? '') as string}
          initialCreatorId={contract.creatorId ?? ''}
          initialDraftContractId={contract.contractId ?? ''}
          initialContractType={contractType}
          allowedContractTypes={[contractType]}
          title="上传合同文件"
          submitLabel="保存并进入识别确认"
          onClose={() => setGeneratedUploadOpen(false)}
          onSave={saveGeneratedUpload}
        />
      ) : null}
      {frameworkUploadOpen ? (
        <ContractUploadWizard
          projects={projects}
          creators={creators}
          contracts={contracts}
          initialProjectId={(contract.cooperationProjectId ?? contract.projectId ?? '') as string}
          initialCreatorId={contract.creatorId ?? ''}
          initialContractType="FRAMEWORK"
          allowedContractTypes={['FRAMEWORK']}
          title="上传并绑定框架合同"
          submitLabel="保存并绑定框架合同"
          onClose={() => setFrameworkUploadOpen(false)}
          onSave={saveFrameworkUpload}
        />
      ) : null}
      {signatureConfirmationOpen ? (
        <Modal
          title="发送达人签署"
          width="860px"
          className="contract-signature-send-modal"
          onClose={closeSignatureConfirmation}
          footer={(
            <>
              <Button variant="secondary" disabled={signatureSending} onClick={closeSignatureConfirmation}>取消</Button>
              <Button
                icon={<FileSignature size={15} />}
                disabled={signatureSending}
                onClick={() => void sendForSignature()}
              >{signatureSending ? '发送中…' : '发送达人签署'}</Button>
            </>
          )}
        >
          <div className="contract-signature-send-content">
            <div className="contract-signature-send-intro">
              <span><FileSignature size={20} aria-hidden="true" /></span>
              <div>
                <strong>请核对签署通知信息</strong>
                <p>以下内容来自两页已确认的识别结果，发送后将冻结并进入“待签署”。</p>
              </div>
              <em>模拟 DocuSign</em>
            </div>

            <section className="contract-signature-send-section" aria-labelledby="contract-signature-summary-title">
              <header>
                <strong id="contract-signature-summary-title">合同确认信息</strong>
                <small>发送内容将随签署请求冻结</small>
              </header>
              <dl className="contract-signature-send-grid">
                <div><dt>Advertiser</dt><dd>{signatureSourceContract.advertiser || '待补充'}</dd></div>
                <div><dt>Publisher</dt><dd>{signatureSourceContract.publisher || '待补充'}</dd></div>
                <div><dt>合同金额</dt><dd>{formatContractMoney(signatureSourceContract)}</dd></div>
                <div><dt>手续费承担方</dt><dd>{FEE_BEARER_LABELS[signatureSourceContract.feeBearer]}</dd></div>
                <div><dt>付款渠道</dt><dd>{signaturePaymentInformation.channel}</dd></div>
              </dl>
            </section>

            <section className="contract-signature-send-section" aria-labelledby="contract-signature-payment-title">
              <header>
                <strong id="contract-signature-payment-title">付款信息</strong>
                <small>{signaturePaymentInformation.source === 'recognized-contract'
                  ? '优先使用合同识别快照，缺失字段已回退冻结付款账户'
                  : '未识别到独立付款信息，使用合同冻结付款账户'}</small>
              </header>
              <dl className="contract-signature-payment-grid">
                {signaturePaymentInformation.fields.map((field) => (
                  <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>
                ))}
              </dl>
            </section>

            <label className={`contract-signature-signer-field${signatureSendError ? ' is-error' : ''}`}>
              <span>签署人 *</span>
              <input
                value={signatureSignerName}
                maxLength={120}
                aria-invalid={Boolean(signatureSendError)}
                aria-describedby={signatureSendError ? 'contract-signature-send-error' : undefined}
                placeholder="请输入签署人"
                disabled={signatureSending}
                onChange={(event) => {
                  setSignatureSignerName(event.target.value);
                  if (signatureSendError) setSignatureSendError('');
                }}
              />
              <small>默认为 Publisher，可根据实际签署主体修改。</small>
            </label>
            {signatureSendError ? (
              <p id="contract-signature-send-error" className="contract-signature-send-error" role="alert">
                <AlertTriangle size={14} aria-hidden="true" />
                {signatureSendError}
              </p>
            ) : null}
            <p className="contract-signature-send-note">
              当前为纯前端原型：会生成模拟 envelope ID 和发送快照，不会调用真实 DocuSign 或达人端服务。
            </p>
          </div>
        </Modal>
      ) : null}
      {templateDeactivateConfirmationOpen ? (
        <Modal
          title="停用合同模板"
          width="480px"
          className="contract-template-status-modal"
          onClose={() => setTemplateDeactivateConfirmationOpen(false)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setTemplateDeactivateConfirmationOpen(false)}>取消</Button>
              <Button variant="danger" icon={<PowerOff size={15} />} onClick={() => updateTemplateStatus('INACTIVE')}>确认停用</Button>
            </>
          )}
        >
          <div className="contract-template-status-confirmation">
            <span><AlertTriangle size={22} aria-hidden="true" /></span>
            <div>
              <strong>停用后将不能用于新建合同</strong>
              <p>既有草稿和历史合同会继续使用已冻结的字段配置，不受本次停用影响。</p>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
