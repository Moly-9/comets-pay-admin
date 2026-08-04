import type { ContractRecord, ContractStatus } from '../contracts';
import type {
  InvoiceCurrency,
  InvoiceDocumentModel,
  CreatorPaymentDetails,
} from '../types';
import type {
  ProjectDocumentContext,
  ProjectResourceKind,
  ProjectResourceRecord,
} from '../projectResources';
import { ContractDetailPage } from './ContractDetailPage';
import { InvoiceDetailPage } from './InvoiceDetailPage';

type Notify = (title: string, message: string) => void;

const fieldValue = (record: ProjectResourceRecord, label: string) => (
  record.fields.find((field) => field.label === label)?.value ?? ''
);

const parseMoney = (value: string): { currency: InvoiceCurrency; amount: number } => {
  const currencyMatch = value.match(/\b(USD|EUR|GBP|HKD)\b/i);
  const amountMatch = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return {
    currency: (currencyMatch?.[1]?.toUpperCase() as InvoiceCurrency | undefined) ?? 'USD',
    amount: amountMatch ? Number(amountMatch[0]) : 0,
  };
};

const normalizedCreatorName = (value: string) => value.replace(/^@/, '').trim() || 'Creator';

const creatorEmail = (value: string) => {
  const localPart = normalizedCreatorName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return `${localPart || 'creator'}@creator.example`;
};

const contractStatus = (status: string): ContractStatus => {
  if (status.includes('归档')) return '已归档';
  if (status.includes('履约')) return '履约中';
  if (status.includes('待签')) return '待签署';
  if (status.includes('待补')) return '待补字段';
  if (status.includes('解析')) return '待解析';
  return '已生效';
};

const paymentSnapshot = (
  creator: string,
  channel: string,
  reference: string,
): CreatorPaymentDetails => {
  const name = normalizedCreatorName(creator);
  const suffix = reference.replace(/\D/g, '').slice(-4).padStart(4, '0');
  const isPayPal = channel.toLowerCase().includes('paypal');
  return {
    bankCountry: 'Hong Kong SAR China',
    accountName: isPayPal ? '' : name,
    accountType: 'Checking',
    swiftCode: isPayPal ? '' : 'COMETHKHH',
    accountNumber: isPayPal ? '' : `0000 0000 ${suffix}`,
    iban: '',
    beneficiaryType: 'PERSONAL',
    bankName: isPayPal ? '' : 'Creator Beneficiary Bank',
    bankStreetAddress: isPayPal ? '' : '1 Finance Street',
    bankCity: isPayPal ? '' : 'Hong Kong',
    bankState: '',
    bankPostalCode: '000000',
    intermediaryBankCountry: '',
    intermediaryBankCode: '',
    transferRemarks: '',
    paypalUsername: isPayPal ? name : '',
    paypalEmail: isPayPal ? creatorEmail(creator) : '',
  };
};

export const buildProjectContract = ({
  project,
  record,
  linkedInvoiceId,
}: {
  project: ProjectDocumentContext;
  record: ProjectResourceRecord;
  linkedInvoiceId?: string;
}): ContractRecord => {
  const money = parseMoney(record.amount);
  const publisher = fieldValue(record, '签约达人') || record.title.replace(/\s*达人合作协议$/, '');
  const status = contractStatus(record.status);
  const signed = status !== '待签署' && status !== '待补字段' && status !== '待解析';
  const updated = fieldValue(record, '签署 / 更新时间') || record.subtitle.split(' · ')[0] || '2026-07-18';

  return {
    id: record.id,
    ioId: `IO-${record.id.replace(/^CON-/, '')}`,
    name: record.title,
    templateFamily: '2026 达人社交媒体推广服务合同',
    sourceName: fieldValue(record, '归档文件') || `${record.id}.pdf`,
    documentUrl: '',
    documentNote: `当前项目使用签署时冻结的合同快照还原全文；${linkedInvoiceId ? `已一一关联 ${linkedInvoiceId}` : '关联 Invoice 待确认'}，并与合同管理采用相同阅读界面。`,
    pageCount: 6,
    isTemplate: false,
    project: project.name,
    brand: project.brand,
    advertiser: 'COMETS INTERNATIONAL LIMITED',
    publisher,
    channelName: publisher.startsWith('@') ? publisher : `@${publisher.replace(/\s+/g, '')}`,
    channelLink: '',
    platform: 'Social Media',
    effectiveDate: updated.replace(/^最后更新\s*/, '').split(' ')[0],
    campaignStart: '2026-07-20',
    campaignEnd: '2026-08-20',
    currency: money.currency,
    totalFee: money.amount,
    licensePrice: null,
    licenseIncludedInTotal: true,
    invoiceWithinWorkingDays: 3,
    paymentWithinWorkingDays: 45,
    feeBearer: 'ADVERTISER',
    paymentMethod: record.channel === 'PayPal' ? 'PAYPAL' : 'BANK',
    accountName: publisher,
    accountFingerprint: `•••• ${record.id.replace(/\D/g, '').slice(-4).padStart(4, '0')}`,
    signed,
    status,
    updated,
    deliverables: [
      {
        id: `${record.id}-deliverable-1`,
        title: `${project.name} 达人内容合作`,
        description: '按项目 Brief 完成内容制作、品牌审核、发布及交付证据回传。',
        source: 'IO · Deliverables',
      },
      {
        id: `${record.id}-deliverable-2`,
        title: '素材授权与合规',
        description: '在约定授权期内提供项目素材使用权，并遵守平台广告披露与品牌安全要求。',
        source: 'IO · Content License',
      },
    ],
    issues: signed ? [] : [{
      id: `${record.id}-signature`,
      label: '合同尚未完成签署',
      description: '双方签署完成后才能进入付款流程。',
      severity: 'blocker',
      source: '签署页',
    }],
  };
};

export const buildProjectInvoice = ({
  project,
  record,
}: {
  project: ProjectDocumentContext;
  record: ProjectResourceRecord;
}): InvoiceDocumentModel => {
  const money = parseMoney(record.amount);
  const creator = fieldValue(record, '达人 / 收款人') || record.title;
  const invoiceDate = fieldValue(record, 'Invoice 日期') || record.subtitle.split(' · ')[0] || '2026-07-18';
  const channel = fieldValue(record, '付款渠道') || record.channel || 'Airwallex';
  const paymentMethod = channel.toLowerCase().includes('paypal') ? 'paypal' : 'bank';

  return {
    invoiceNumber: record.id,
    invoiceDate,
    billTo: {
      name: 'COMETS INTERNATIONAL LIMITED',
      address: 'Unit 18, 16/F, Harbour Centre, Hong Kong',
    },
    creatorHandle: creator.startsWith('@') ? creator : `@${creator.replace(/\s+/g, '')}`,
    creatorName: normalizedCreatorName(creator),
    projectId: project.id,
    projectName: project.name,
    from: {
      legalName: normalizedCreatorName(creator),
      address: 'Contact address recorded in creator profile',
      phone: '+852 0000 0000',
      email: creatorEmail(creator),
    },
    currency: money.currency,
    items: [{
      id: `${record.id}-line-1`,
      description: `${project.name} · 达人合作服务费`,
      unitPrice: money.amount,
      quantity: 1,
      lineTotal: money.amount,
    }],
    paymentMethod,
    payment: paymentSnapshot(creator, channel, record.id),
  };
};

export function ProjectDocumentDetailPage({
  kind,
  project,
  record,
  linkedRecord,
  onBack,
  notify,
}: {
  kind: Extract<ProjectResourceKind, 'contract' | 'invoice'>;
  project: ProjectDocumentContext;
  record: ProjectResourceRecord;
  linkedRecord?: ProjectResourceRecord;
  onBack: () => void;
  notify: Notify;
}) {
  if (kind === 'contract') {
    const contract = buildProjectContract({
      project,
      record,
      linkedInvoiceId: linkedRecord?.id,
    });
    return (
      <ContractDetailPage
        contract={contract}
        notify={notify}
        backLabel={`返回${project.name} · 合同资料`}
        onBack={onBack}
      />
    );
  }

  const model = buildProjectInvoice({ project, record });
  return (
    <InvoiceDetailPage
      source={{
        kind: 'project',
        status: record.status,
        contractId: linkedRecord?.id || fieldValue(record, '关联合同') || '待关联',
        ioId: linkedRecord ? `IO-${linkedRecord.id.replace(/^CON-/, '')}` : '待关联',
        provider: record.channel || fieldValue(record, '付款渠道') || '待路由',
      }}
      model={model}
      backLabel={`返回${project.name} · Invoice 列表`}
      notify={notify}
      onMarkSigned={() => undefined}
      onReviewAction={() => undefined}
      canManageInvoice={false}
      canReviewMedia={false}
      canReviewFinance={false}
      onBack={onBack}
    />
  );
}
