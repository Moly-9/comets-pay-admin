import { normalizeInvoiceBatchChannelUrl } from './invoice/invoiceBatchCreatorImport';
import type { CreatorProfile } from './types';
import type { CreatorId } from './businessWorkflow';

export type PaymentRequestCreatorLinkMatch = {
  creatorId: CreatorId;
  socialAccountId: string;
  sourceLine: number;
  sourceValue: string;
};

export type PaymentRequestCreatorLinkIssue = {
  code: 'INVALID_LINK' | 'NOT_FOUND' | 'AMBIGUOUS' | 'DUPLICATE';
  sourceLine: number;
  sourceValue: string;
  message: string;
};

const parseProfileUrl = (value: string) => {
  const source = value.trim();
  if (!source || /\s/.test(source)) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(source) ? source : `https://${source}`);
    if (!parsed.hostname.includes('.')) return null;
    return normalizeInvoiceBatchChannelUrl(source);
  } catch {
    return null;
  }
};

export const matchPaymentRequestCreatorProfileLinks = ({
  value,
  creators,
}: {
  value: string;
  creators: CreatorProfile[];
}) => {
  const matches: PaymentRequestCreatorLinkMatch[] = [];
  const issues: PaymentRequestCreatorLinkIssue[] = [];
  const seenCreatorIds = new Set<CreatorId>();

  value.split(/\r?\n/).forEach((rawValue, index) => {
    const sourceValue = rawValue.trim();
    if (!sourceValue) return;
    const sourceLine = index + 1;
    const normalized = parseProfileUrl(sourceValue);
    if (!normalized) {
      issues.push({
        code: 'INVALID_LINK',
        sourceLine,
        sourceValue,
        message: `第 ${sourceLine} 行不是有效的社媒主页链接`,
      });
      return;
    }

    const candidates = creators.flatMap((creator) => creator.socialAccounts.flatMap((account) => (
      normalizeInvoiceBatchChannelUrl(account.profileUrl) === normalized
        ? [{ creator, socialAccountId: account.id }]
        : []
    )));
    if (!candidates.length) {
      issues.push({
        code: 'NOT_FOUND',
        sourceLine,
        sourceValue,
        message: `第 ${sourceLine} 行未匹配到达人档案`,
      });
      return;
    }

    const creatorIds = new Set(candidates.map(({ creator }) => creator.id));
    if (creatorIds.size > 1) {
      issues.push({
        code: 'AMBIGUOUS',
        sourceLine,
        sourceValue,
        message: `第 ${sourceLine} 行匹配到多位达人，请检查达人档案中的频道链接`,
      });
      return;
    }

    const candidate = candidates[0];
    const creatorId = candidate.creator.id as CreatorId;
    if (seenCreatorIds.has(creatorId)) {
      issues.push({
        code: 'DUPLICATE',
        sourceLine,
        sourceValue,
        message: `第 ${sourceLine} 行与前面的链接属于同一达人，已自动去重`,
      });
      return;
    }

    seenCreatorIds.add(creatorId);
    matches.push({
      creatorId,
      socialAccountId: candidate.socialAccountId,
      sourceLine,
      sourceValue,
    });
  });

  return { matches, issues };
};
