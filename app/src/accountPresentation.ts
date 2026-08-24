export const LEGACY_MASKED_ACCOUNT_LABEL = '历史记录未保存完整账号';

const LEGACY_MASK_MARKERS = /[•*]|(?:账户)?尾号|已脱敏|脱敏(?:账户|账号|邮箱)/;

export const isLegacyMaskedAccountValue = (value: string | null | undefined) => (
  LEGACY_MASK_MARKERS.test(String(value ?? '').trim())
);

export const accountDisplayValue = (
  value: string | null | undefined,
  emptyLabel = '待补充',
) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return emptyLabel;
  return isLegacyMaskedAccountValue(normalized)
    ? LEGACY_MASKED_ACCOUNT_LABEL
    : normalized;
};

export const emailDisplayValue = (
  value: string | null | undefined,
  emptyLabel = '达人档案邮箱待补充',
) => accountDisplayValue(value, emptyLabel);
