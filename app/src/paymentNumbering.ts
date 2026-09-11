import type { Payout } from './types';

export type PaymentBusinessCodePrefix = 'PAY' | 'PMT';

export const PAYMENT_BUSINESS_TIME_ZONE = 'Asia/Shanghai';
export const PAYMENT_BUSINESS_CODE_PATTERN = /^(PAY|PMT)-(\d{6})(\d{4})$/;

const shanghaiDateParts = (now: Date) => {
  if (Number.isNaN(now.getTime())) throw new Error('付款编号生成时间无效');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PAYMENT_BUSINESS_TIME_ZONE,
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => (
    parts.find((part) => part.type === type)?.value ?? ''
  );
  return `${value('year')}${value('month')}${value('day')}`;
};

export const paymentBusinessDate = (now = new Date()) => shanghaiDateParts(now);

export const isPaymentBusinessCode = (
  value: unknown,
  prefix?: PaymentBusinessCodePrefix,
) => {
  const match = String(value ?? '').match(PAYMENT_BUSINESS_CODE_PATTERN);
  return Boolean(match && (!prefix || match[1] === prefix));
};

export const nextPaymentBusinessCode = (
  prefix: PaymentBusinessCodePrefix,
  existingCodes: Iterable<string | undefined>,
  now = new Date(),
) => {
  const date = paymentBusinessDate(now);
  let maximumSequence = 0;
  for (const code of existingCodes) {
    const match = String(code ?? '').match(PAYMENT_BUSINESS_CODE_PATTERN);
    if (!match || match[1] !== prefix || match[2] !== date) continue;
    maximumSequence = Math.max(maximumSequence, Number(match[3]));
  }
  if (maximumSequence >= 9999) {
    throw new Error(`${prefix} ${date} 当日编号已达到 9999 上限，请联系管理员处理`);
  }
  return `${prefix}-${date}${String(maximumSequence + 1).padStart(4, '0')}`;
};

export const reservePaymentBusinessCodes = (
  prefix: PaymentBusinessCodePrefix,
  existingCodes: Iterable<string | undefined>,
  count: number,
  now = new Date(),
) => {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('付款编号预留数量无效');
  const reserved = [...existingCodes];
  return Array.from({ length: count }, () => {
    const code = nextPaymentBusinessCode(prefix, reserved, now);
    reserved.push(code);
    return code;
  });
};

const DEMO_PAYMENT_CODE_DATE = new Date('2026-08-06T12:00:00+08:00');

/**
 * 为缺少业务付款编号的前端演示数据做稳定迁移。传入顺序不会影响结果；已有合法编号保留。
 */
export const assignMissingDemoPaymentCodes = <T extends Payout>(payouts: readonly T[]): T[] => {
  const sorted = [...payouts].sort((left, right) => left.id.localeCompare(right.id));
  const preservedCodes = new Set<string>();
  const missing = sorted.filter((payout) => {
    if (!isPaymentBusinessCode(payout.paymentCode, 'PMT') || preservedCodes.has(payout.paymentCode!)) {
      return true;
    }
    preservedCodes.add(payout.paymentCode!);
    return false;
  });
  const newCodes = reservePaymentBusinessCodes(
    'PMT',
    preservedCodes,
    missing.length,
    DEMO_PAYMENT_CODE_DATE,
  );
  const assignments = new Map(missing.map((payout, index) => [
    payout.id,
    newCodes[index],
  ]));
  return payouts.map((payout) => ({
    ...payout,
    paymentCode: isPaymentBusinessCode(payout.paymentCode, 'PMT')
      && preservedCodes.has(payout.paymentCode!)
      && !assignments.has(payout.id)
      ? payout.paymentCode
      : assignments.get(payout.id),
  }));
};

export const normalizeLegacyPaymentOrderCode = (
  value: string,
  fallbackDate: string,
  fallbackSequence: number,
) => {
  if (isPaymentBusinessCode(value, 'PAY')) return value;
  const shortDate = value.match(/^PAY-(\d{6})-(\d+)$/);
  if (shortDate && Number(shortDate[2]) <= 9999) {
    return `PAY-${shortDate[1]}${String(Number(shortDate[2])).padStart(4, '0')}`;
  }
  const longDate = value.match(/^PAY-(\d{4})(\d{2})(\d{2})-(\d+)$/);
  if (longDate && Number(longDate[4]) <= 9999) {
    return `PAY-${longDate[1].slice(2)}${longDate[2]}${longDate[3]}${String(Number(longDate[4])).padStart(4, '0')}`;
  }
  if (!/^\d{6}$/.test(fallbackDate) || fallbackSequence < 1 || fallbackSequence > 9999) {
    throw new Error('演示付款单编号迁移参数无效');
  }
  return `PAY-${fallbackDate}${String(fallbackSequence).padStart(4, '0')}`;
};
