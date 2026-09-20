import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CollaborationInvoiceDrawer } from '../components/CollaborationInvoiceDrawer';
import {
  buildCollaborationProjectFilterOptions,
  filterCollaborationRowsByProject,
} from '../components/CollaborationProjectFilter';
import { buildCollaborationInvoiceRows } from '../collaborationInvoices';
import type { ContractRecord } from '../contracts';
import type { ProjectSummary } from './ProjectDetailPage';
import type { RequestProjectSummary } from './RequestProjectDetailPage';
import type { CreatorProfile, GeneratedInvoiceRecord, Payout } from '../types';
import { CollaborationsPage, filterCollaborationInvoiceRows } from './OperationalPages';

const creator = {
  id: 'creator-collaboration',
  name: 'Collaboration Display Name',
  handle: '@collaboration',
  platform: 'YouTube',
  initials: 'CD',
  accent: '#64748b',
  region: '日本',
  projects: 1,
  socialAccounts: [{ id: 'social-collaboration', handle: '@collaboration-channel', platform: 'YouTube', profileUrl: '' }],
  contact: { legalName: 'Collaboration Studio', address: '', phone: '', email: '' },
  payoutAccounts: [],
} as CreatorProfile;

const project = {
  projectId: 'project-collaboration',
  cooperationProjectId: 'project-collaboration',
  projectCode: 'PRJ-COLLABORATION',
  cooperationProjectCode: 'PRJ-COLLABORATION',
  name: 'Launch Project',
  brand: 'COMETS',
  media: 'Media Owner',
  pm: 'Project PM',
  creators: 1,
  budget: 'USD 1,500',
  status: '进行中',
} as unknown as ProjectSummary;

const contract = {
  contractId: 'contract-collaboration',
  id: 'CON-COLLABORATION',
  name: 'Launch Project Contract',
  contractType: 'INDEPENDENT',
  signed: true,
  status: '已生效',
  currency: 'USD',
  totalFee: 1500,
  campaignStart: '2026-08-01',
  campaignEnd: '2026-08-31',
  isTemplate: false,
} as unknown as ContractRecord;

const invoice = {
  id: 'INV-COLLABORATION',
  invoiceId: 'invoice-collaboration',
  invoiceType: 'INTERNAL',
  sourcePayoutId: 'payout-collaboration',
  status: '已通过',
  generatedAt: '2026-08-01T02:00:00.000Z',
  validationStatus: 'valid',
  version: 1,
  snapshot: {
    invoiceNumber: 'INV-COLLABORATION',
    invoiceDate: '2026-08-01',
    creatorId: creator.id,
    creatorName: creator.name,
    creatorHandle: '@collaboration-channel',
    creatorSocialAccountId: 'social-collaboration',
    creatorPlatform: 'YouTube',
    projectId: 'project-collaboration',
    cooperationProjectId: 'project-collaboration',
    projectName: project.name,
    contractIds: ['contract-collaboration'],
    billTo: { name: 'COMETS', address: '' },
    from: creator.contact,
    currency: 'USD',
    items: [{ id: 'line', description: 'YouTube launch video', unitPrice: 1500, quantity: 1, lineTotal: 1500 }],
    paymentMethod: 'bank',
    payment: {},
  },
} as unknown as GeneratedInvoiceRecord;

const payout = {
  id: 'payout-collaboration',
  creator: creator.name,
  creatorId: creator.id,
  handle: '@collaboration-channel',
  creatorSocialAccountId: 'social-collaboration',
  creatorPlatform: 'YouTube',
  initials: 'CD',
  accent: '#64748b',
  projectId: 'project-collaboration',
  project: project.name,
  contract: contract.id,
  invoice: invoice.id,
  provider: 'Airwallex',
  currency: 'USD',
  amount: 1500,
  account: '0000001234',
  status: '未进入付款',
  invoiceReviewStatus: '已通过',
} as Payout;

const request = {
  id: 'REQ-COLLABORATION',
  requestCode: 'REQ-COLLABORATION',
  paymentRequestProjectId: 'request-collaboration',
  lifecycle: 'SUBMITTED',
  media: 'Media Owner',
  pm: 'Project PM',
  project: project.name,
  brand: project.brand,
  amount: 'USD 1,500',
  contracts: 1,
  invoices: 1,
  paymentOrder: 'PAY-COLLABORATION',
  status: '财务审批中',
  filter: 'pending',
  creatorLinks: [{ creatorId: creator.id, engagementId: 'engagement', contractIds: ['contract-collaboration'], invoiceIds: ['invoice-collaboration'] }],
  approval: {
    status: 'PENDING_FINANCE',
    round: 1,
    history: [],
    submittedAt: '2026-08-02T03:00:00.000Z',
    submissionHistory: [{ round: 1, submittedAt: '2026-08-02T03:00:00.000Z' }],
    updatedAt: '2026-08-02T03:00:00.000Z',
  },
} as unknown as RequestProjectSummary;

const commonProps = {
  notify: vi.fn(),
  canExport: true,
  creators: [creator],
  projects: [project],
  contracts: [contract],
  payouts: [payout],
  generatedInvoices: [invoice],
  externalInvoices: [],
  requests: [request],
  paymentLists: [],
};

describe('CollaborationsPage', () => {
  it('renders the Invoice-driven columns, shared creator identity and request status', () => {
    const html = renderToStaticMarkup(<CollaborationsPage {...commonProps} />);

    ['达人', '关联项目', '合作交付', 'Invoice 编号', '付款进度', '请款时间', '操作']
      .forEach((heading) => expect(html).toContain(`>${heading}</th>`));
    expect(html).toContain('Collaboration Display Name');
    expect(html).toContain('@collaboration-channel');
    expect(html).toContain('YouTube launch video');
    expect(html).toContain('INV-COLLABORATION');
    expect(html).toContain('财务审批中');
    expect(html).toContain('aria-label="关联项目筛选"');
    expect(html).toContain('全部关联项目');
    expect(html).toContain('查看详情');
    expect(html).toContain('导出合作名单');
    expect(html).not.toContain('导入合作名单');
    expect(html).not.toContain('查看链路');
    expect(html).not.toContain('所属项目');
  });

  it('builds searchable project options and filters rows by the stable project link', () => {
    const rows = buildCollaborationInvoiceRows({
      ...commonProps,
      generatedInvoices: [
        invoice,
        {
          ...invoice,
          id: 'INV-COLLABORATION-2',
          invoiceId: 'invoice-collaboration-2',
          sourcePayoutId: 'payout-collaboration-2',
          snapshot: {
            ...invoice.snapshot,
            invoiceNumber: 'INV-COLLABORATION-2',
          },
        } as GeneratedInvoiceRecord,
      ],
    });
    const options = buildCollaborationProjectFilterOptions(rows);
    const launchProject = options.find((option) => option.label === 'Launch Project');

    expect(options[0]).toMatchObject({ value: 'all', invoiceCount: 2 });
    expect(launchProject).toMatchObject({
      value: 'project:project-collaboration',
      invoiceCount: 2,
    });
    expect(launchProject?.searchText).toContain('PRJ-COLLABORATION');
    expect(filterCollaborationRowsByProject(rows, launchProject?.value ?? '')).toHaveLength(2);
    expect(filterCollaborationRowsByProject(rows, 'project:missing')).toHaveLength(0);
  });

  it('renders only the creators, projects and generated Invoices passed from current app state', () => {
    const emptyHtml = renderToStaticMarkup(<CollaborationsPage
      {...commonProps}
      creators={[]}
      projects={[]}
      contracts={[]}
      payouts={[]}
      generatedInvoices={[]}
      requests={[]}
    />);

    expect(emptyHtml).toContain('暂无符合条件的 Invoice');
    expect(emptyHtml).not.toContain('Collaboration Display Name');
    expect(emptyHtml).not.toContain('Launch Project');
    expect(emptyHtml).not.toContain('INV-COLLABORATION');
    expect(emptyHtml).toMatch(/<button[^>]*disabled=""[^>]*>.*?导出合作名单<\/span><\/button>/s);
    expect(renderToStaticMarkup(<CollaborationsPage {...commonProps} canExport={false} />))
      .not.toContain('导出合作名单');
  });

  it('exports from the same search and project-filter result before pagination', () => {
    const rows = buildCollaborationInvoiceRows(commonProps);
    const [row] = rows;
    const otherProject = { ...row, rowId: 'other', projectLinkId: 'another-project', searchText: 'other' };
    const allMatching = Array.from({ length: 15 }, (_, index) => ({
      ...row,
      rowId: `invoice:${index}`,
      invoiceNumber: `INV-${index}`,
    }));
    const filtered = filterCollaborationInvoiceRows(
      [otherProject, ...allMatching], '  LAUNCH PROJECT ', 'project:project-collaboration',
    );
    expect(filtered).toHaveLength(15);
    expect(filtered.map((item) => item.invoiceNumber)).toEqual(allMatching.map((item) => item.invoiceNumber));
    expect(filterCollaborationInvoiceRows([row], 'missing', 'all')).toEqual([]);
  });
});

describe('CollaborationInvoiceDrawer', () => {
  it('renders the streamlined linked resources in order and keeps payment events in the timeline', () => {
    const payoutWithFailureAttempt = {
      ...payout,
      paymentAttempts: [{
        attemptNumber: 1,
        status: '付款失败',
        occurredAt: '2026-08-03T04:00:00.000Z',
        principalAmount: 1500,
        principalCurrency: 'USD',
        errorCode: 'PROTOTYPE_DECLINE',
        providerResponse: 'Prototype transfer declined.',
      }],
    } as Payout;
    const [row] = buildCollaborationInvoiceRows({
      creators: [creator],
      projects: [project],
      contracts: [contract],
      payouts: [payoutWithFailureAttempt],
      generatedInvoices: [invoice],
      externalInvoices: [],
      requests: [request],
      paymentLists: [],
    });
    const html = renderToStaticMarkup(<CollaborationInvoiceDrawer row={row} onClose={vi.fn()} />);

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="达人"');
    const heroStart = html.indexOf('aria-label="达人"');
    const heroEnd = html.indexOf('</section>', heroStart);
    expect(html.slice(heroStart, heroEnd)).not.toContain('Launch Project');
    expect(html).toContain('关联项目');
    expect(html).toContain('PRJ-COLLABORATION');
    expect(html).toContain('合作品牌');
    expect(html).not.toContain('>项目预算</dt>');
    expect(html).not.toContain('>媒介</dt>');
    expect(html).not.toContain('>PM</dt>');
    expect(html).toContain('关联合同');
    expect(html).toContain('CON-COLLABORATION');
    expect(html).toContain('Launch Project Contract');
    expect(html).toContain('付款就绪度');
    expect(html).not.toContain('合同状态');
    expect(html).not.toContain('签署状态');
    expect(html).not.toContain('Invoice 版本');
    expect(html).toContain('请款信息');
    expect(html).toContain('REQ-COLLABORATION');
    expect(html).not.toContain('审批轮次');
    expect(html).toContain('合作交付');
    expect(html).toContain('YouTube launch video');
    expect(html).not.toContain('付款信息');
    expect(html).not.toContain('收款账户');
    expect(html).not.toContain('付款渠道');
    expect(html).toContain('全链路时间线');
    expect(html).toContain('渠道付款失败');

    const projectIndex = html.indexOf('>关联项目</h3>');
    const invoiceIndex = html.indexOf('>Invoice 信息</h3>');
    const contractIndex = html.indexOf('>关联合同</h3>');
    const requestIndex = html.indexOf('>请款信息</h3>');
    const timelineIndex = html.indexOf('>全链路时间线</h3>');
    expect(projectIndex).toBeGreaterThan(-1);
    expect(invoiceIndex).toBeGreaterThan(projectIndex);
    expect(contractIndex).toBeGreaterThan(invoiceIndex);
    expect(requestIndex).toBeGreaterThan(contractIndex);
    expect(timelineIndex).toBeGreaterThan(requestIndex);
  });
});
