import { describe, expect, it } from 'vitest';
import {
  LEGACY_MASKED_ACCOUNT_LABEL,
  accountDisplayValue,
  emailDisplayValue,
  isLegacyMaskedAccountValue,
} from './accountPresentation';

describe('account presentation', () => {
  it('preserves complete bank, routing and email values', () => {
    expect(accountDisplayValue(' 0000 1111 2222 3456 ')).toBe('0000 1111 2222 3456');
    expect(accountDisplayValue('ES00 DEMO 0000 0000 0000 0000')).toBe('ES00 DEMO 0000 0000 0000 0000');
    expect(accountDisplayValue('beneficiary-demo-12345678')).toBe('beneficiary-demo-12345678');
    expect(emailDisplayValue('creator.payment@example.com')).toBe('creator.payment@example.com');
  });

  it('does not treat stored masks as complete account data', () => {
    ['•••• 3456', 'c***@example.test', '账户尾号 4826', '已脱敏'].forEach((value) => {
      expect(isLegacyMaskedAccountValue(value)).toBe(true);
      expect(accountDisplayValue(value)).toBe(LEGACY_MASKED_ACCOUNT_LABEL);
    });
  });

  it('keeps caller-specific empty labels', () => {
    expect(accountDisplayValue('')).toBe('待补充');
    expect(accountDisplayValue('', '待选择')).toBe('待选择');
    expect(emailDisplayValue('')).toBe('达人档案邮箱待补充');
  });
});
