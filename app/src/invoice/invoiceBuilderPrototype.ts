import type { ContractRecord } from '../contracts';
import { contractLinkedToProject, isPaymentContract } from '../contracts';
import {
  eligibleInvoicePayoutAccounts,
  getPayoutAccountId,
  payoutAccountToInvoicePayment,
} from '../payoutAccounts';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import type {
  CreatorProfile,
  DocumentPayoutSnapshot,
  GeneratedInvoiceRecord,
  InvoiceCurrency,
  InvoicePaymentMethod,
  Payout,
} from '../types';
import type { CreatorId, EngagementId } from '../businessWorkflow';

const SUPPORTED_CURRENCIES = new Set<InvoiceCurrency>(['USD', 'EUR', 'GBP', 'HKD', 'SGD']);

export type InvoiceBuilderPrototypeSeed = {
  creatorId: CreatorId;
  engagementId: EngagementId;
  currency: InvoiceCurrency;
  lineItems: Array<{
    description: string;
    unitPrice: number;
    quantity: number;
  }>;
  payoutAccountId: string;
  paymentMethod: InvoicePaymentMethod;
  payment: DocumentPayoutSnapshot;
};

type InvoiceBuilderPrototypeSeedOptions = {
  creators: CreatorProfile[];
  payouts: Payout[];
  projects: ProjectSummary[];
  contracts: ContractRecord[];
  generatedInvoices: GeneratedInvoiceRecord[];
};

const projectIdFor = (project: ProjectSummary) => (
  project.cooperationProjectId ?? project.projectId ?? project.id
);

export const createInvoiceBuilderPrototypeSeed = ({
  creators,
  payouts,
  projects,
  contracts,
  generatedInvoices,
}: InvoiceBuilderPrototypeSeedOptions): InvoiceBuilderPrototypeSeed | null => {
  const candidates = projects.flatMap((project) => (
    (project.creatorProfiles ?? []).flatMap((reference) => {
      if (
        reference.status === 'removed'
      ) return [];

      const creator = creators.find((item) => item.id === reference.creatorId);
      const accounts = eligibleInvoicePayoutAccounts(creator);
      if (!creator || !accounts.length) return [];

      const payout = payouts.find((item) => (
        item.creatorId === creator.id
        && item.projectId === projectIdFor(project)
      ));
      const matchingAccount = accounts.find((account) => account.provider === payout?.provider);
      const account = matchingAccount ?? accounts.find((item) => item.isDefault) ?? accounts[0];
      const confirmedContractCount = contracts.filter((contract) => (
        contract.creatorId === reference.creatorId
        && contractLinkedToProject(contract, projectIdFor(project))
        && isPaymentContract(contract)
      )).length;

      return [{
        account,
        confirmedContractCount,
        creator,
        payout,
        reference,
      }];
    })
  )).sort((left, right) => (
    right.confirmedContractCount - left.confirmedContractCount
    || Number(Boolean(right.payout)) - Number(Boolean(left.payout))
    || left.creator.name.localeCompare(right.creator.name)
  ));

  const candidate = candidates[0];
  if (!candidate) return null;

  const currency = candidate.payout && SUPPORTED_CURRENCIES.has(candidate.payout.currency)
    ? candidate.payout.currency
    : 'USD';
  const paymentMethod: InvoicePaymentMethod = candidate.account.provider === 'PayPal'
    ? 'paypal'
    : 'bank';

  return {
    creatorId: candidate.creator.id as CreatorId,
    engagementId: candidate.reference.engagementId,
    currency,
    lineItems: [
      {
        description: '海外创作者内容制作与发布服务费（演示数据）',
        unitPrice: 1680,
        quantity: 1,
      },
      {
        description: '内容素材授权使用费 30 天（演示数据）',
        unitPrice: 420,
        quantity: 1,
      },
    ],
    payoutAccountId: getPayoutAccountId(candidate.account),
    paymentMethod,
    payment: payoutAccountToInvoicePayment(candidate.account, candidate.creator.id),
  };
};
