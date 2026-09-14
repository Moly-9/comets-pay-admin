import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ContractRecognitionField, ContractSourceLocation } from '../contractRecognitionTypes';
import type { DocumentPayoutSnapshot } from '../types';
import {
  INITIAL_CONTRACTS,
  applyConfirmedRecognitionToContract,
  getContractValidity,
  type ContractRecord,
  type ContractType,
} from '../contracts';
import {
  ContractPaymentList,
  ContractDetailPage,
  contractPaymentAccountRows,
  contractRecognizedAccountRows,
  contractPaymentChannelDisplayValue,
  contractPaymentFieldsFor,
  contractRecognitionKeysToConfirm,
  contractExpiryDisplayValue,
  contractSignaturePaymentInformationFor,
  contractSignatureStatusLabel,
  contractSummaryFieldsFor,
} from './ContractDetailPage';

const source: ContractSourceLocation = {
  documentId: 'contract-detail-test-document',
  documentType: 'IO',
  fileName: 'contract-detail-test.pdf',
  pageNumber: 1,
  section: 'Campaign Period',
  sourceText: 'Campaign Period: August 10, 2026 to September 17, 2026',
  blockId: 'contract-detail-test-block',
};

const recognitionField = (
  fieldKey: ContractRecognitionField['fieldKey'],
  rawValue: string,
  normalizedValue: ContractRecognitionField['normalizedValue'],
): ContractRecognitionField => ({
  fieldKey,
  label: fieldKey,
  rawValue,
  normalizedValue,
  source,
  confidence: 0.98,
  status: 'confirmed',
  candidates: [],
});

const paymentSnapshot = (
  payoutProvider: DocumentPayoutSnapshot['payoutProvider'],
): DocumentPayoutSnapshot => ({
  payoutProvider,
  bankCountry: 'United States',
  accountName: 'Sample Creator LLC',
  accountType: 'Checking',
  swiftCode: 'CHASUS33',
  accountNumber: '50002401',
  iban: 'GB82WEST12345698765432',
  beneficiaryType: 'COMPANY',
  bankName: 'JPMorgan Chase Bank',
  bankStreetAddress: '270 Park Avenue',
  bankCity: 'New York',
  bankState: 'NY',
  bankPostalCode: '10017',
  intermediaryBankCountry: '',
  intermediaryBankCode: '',
  transferRemarks: 'COMETS contract payout',
  paypalUsername: 'sample.creator',
  paypalEmail: 'sample.creator@example.com',
});

describe('ContractDetailPage expiry presentation', () => {
  it('supports a request-scoped read-only contract detail', () => {
    const detailSource = readFileSync(new URL('./ContractDetailPage.tsx', import.meta.url), 'utf8');

    expect(detailSource).toContain('canEdit = true');
    expect(detailSource).toContain('const canEditCurrentContract = canEdit && (!contract.isTemplate || canEditTemplate)');
    expect(detailSource).toContain('recognitionLocked={recognitionApplied || !canEditCurrentContract}');
  });

  it.each(['INDEPENDENT', 'FRAMEWORK', 'IO'] as ContractType[])('shows expiry and derived signature status for %s', (contractType) => {
    const fields = contractSummaryFieldsFor(contractType);

    expect(fields).toContainEqual({ key: 'campaignEnd', label: '合同有效期' });
    expect(fields).toContainEqual({ key: 'signatureStatus', label: '签署状态' });
    expect(fields.some((field) => field.key === 'campaignPeriod')).toBe(false);
    expect(fields.some((field) => field.key === 'effectiveDate')).toBe(false);
  });

  it('uses the same formal campaignEnd and long-term rules as contract-list validity', () => {
    expect(contractExpiryDisplayValue({ campaignEnd: '2026-09-30', isLongTerm: false })).toBe('2026-09-30');
    expect(contractExpiryDisplayValue({ campaignEnd: '', isLongTerm: false })).toBe('未设置');
    expect(contractExpiryDisplayValue({ campaignEnd: '2025-01-01', isLongTerm: true })).toBe('长期有效');
  });

  it('converts a historical Campaign Period to one expiry date picker without counting effectiveDate', () => {
    const campaignPeriod = recognitionField(
      'campaignPeriod',
      'August 10, 2026 to September 17, 2026',
      { startDate: '2026-08-10', endDate: '2026-09-17' },
    );
    const effectiveDate = recognitionField('effectiveDate', 'August 8, 2026', { date: '2026-08-08' });
    const contract = {
      ...INITIAL_CONTRACTS[0],
      contractType: 'IO' as const,
      lifecycle: 'UPLOADED_PENDING_CONFIRMATION' as const,
      extractionStage: 'review' as const,
      recognitionResults: [effectiveDate, campaignPeriod],
    } satisfies ContractRecord;

    const html = renderToStaticMarkup(
      <ContractDetailPage
        contract={contract}
        onBack={() => undefined}
        notify={() => undefined}
      />,
    );

    expect(html).toMatch(/aria-label="合同有效期"[^>]*type="date"[^>]*value="2026-09-17"/);
    expect(html).toContain('aria-label="长期有效"');
    expect(html).not.toContain('data-derived-from="campaignPeriod"');
    expect(html).toContain('本页已确认 1/2 项');
    expect(html).toContain('aria-label="签署状态"');
    expect(html).not.toContain('aria-label="生效日期"');
  });

  it('writes the confirmed Campaign Period end to the formal validity source', () => {
    const campaignPeriod = recognitionField(
      'campaignPeriod',
      'August 10, 2026 to September 17, 2026',
      { startDate: '2026-08-10', endDate: '2026-09-17' },
    );
    const contract = {
      ...INITIAL_CONTRACTS[0],
      campaignEnd: '2026-12-31',
      lifecycle: 'UPLOADED_PENDING_CONFIRMATION' as const,
      recognitionResults: [campaignPeriod],
      issues: [],
    } satisfies ContractRecord;

    const applied = applyConfirmedRecognitionToContract(contract, ['campaignPeriod']);

    expect(applied?.campaignEnd).toBe('2026-09-17');
    expect(getContractValidity(applied!, '2026-09-18')).toMatchObject({
      status: 'EXPIRED',
      endDate: '2026-09-17',
      expired: true,
    });
  });

  it('derives one signature summary value across formal lifecycle states', () => {
    const base = INITIAL_CONTRACTS[0];

    expect(contractSignatureStatusLabel({ ...base, isTemplate: true })).toBe('不适用');
    expect(contractSignatureStatusLabel({ ...base, isTemplate: false, signed: true })).toBe('已签署');
    expect(contractSignatureStatusLabel({
      ...base,
      isTemplate: false,
      signed: false,
      lifecycle: 'SENT_FOR_SIGNATURE',
    })).toBe('待达人签署');
    expect(contractSignatureStatusLabel({
      ...base,
      isTemplate: false,
      signed: false,
      lifecycle: 'RECOGNITION_CONFIRMED',
    })).toBe('未签署');
  });

  it('excludes a missing optional Channel from confirmation but includes it when populated', () => {
    const missingChannel = recognitionField('platformChannel', '', {});
    const populatedChannel = recognitionField('platformChannel', 'YouTube: @sample', {
      platform: 'YouTube',
      handle: '@sample',
      channelUrl: 'https://youtube.com/@sample',
    });
    const publisher = recognitionField('publisher', 'Sample Creator', 'Sample Creator');

    expect(contractRecognitionKeysToConfirm(
      [publisher, missingChannel],
      ['publisher', 'platformChannel'],
    )).toEqual(['publisher']);
    expect(contractRecognitionKeysToConfirm(
      [publisher, populatedChannel],
      ['publisher', 'platformChannel'],
    )).toEqual(['publisher', 'platformChannel']);
  });

  it('keeps contract header actions side by side when the title wraps', () => {
    const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

    expect(styles).toMatch(/\.contract-detail-page > \.page-heading-row > div:first-child\s*{[^}]*min-width:\s*0;/s);
    expect(styles).toMatch(/\.contract-detail-page > \.page-heading-row \.page-heading-actions\s*{[^}]*flex:\s*0 0 auto;[^}]*flex-wrap:\s*nowrap;/s);
    expect(styles).toMatch(/\.contract-detail-page \.page-heading-actions\s*{[^}]*grid-template-columns:\s*1fr 1fr;/s);
  });

  it('preserves payment-rule differences between contract types', () => {
    expect(contractPaymentFieldsFor('INDEPENDENT').map((field) => field.label)).toEqual([
      '付款金额',
      '付款渠道',
      '手续费费用承担方',
    ]);
    expect(contractPaymentFieldsFor('FRAMEWORK').map((field) => field.label)).toEqual([
      '手续费费用承担方',
    ]);
    expect(contractPaymentFieldsFor('IO').map((field) => field.label)).toEqual([
      '付款金额',
      '付款渠道',
    ]);
  });

  it('flattens bank payment details and keeps full account values', () => {
    const contract = {
      ...INITIAL_CONTRACTS[0],
      payoutProvider: 'Airwallex' as const,
      paymentMethod: 'BANK' as const,
    };
    const snapshot = paymentSnapshot('Airwallex');
    const rows = contractPaymentAccountRows(contract, snapshot);
    const html = renderToStaticMarkup(
      <ContractPaymentList
        contract={contract}
        fields={contractPaymentFieldsFor('INDEPENDENT')}
        paymentSnapshot={snapshot}
      />,
    );

    expect(contractPaymentChannelDisplayValue(contract, snapshot)).toBe('Airwallex');
    expect(rows.map((row) => row.label)).toEqual([
      'Account Name',
      'Account Number',
      'Beneficiary Bank Name',
      'Beneficiary Bank Address',
      'SWIFT Code',
      'IBAN',
      'Remittance Information (optional)',
    ]);
    expect(rows.find((row) => row.key === 'beneficiary-bank-address')?.value).toBe(
      '270 Park Avenue, New York, NY, 10017, United States',
    );
    expect(html).toContain('50002401');
    expect(html).not.toContain('付款信息');
    expect(html).not.toContain('达人付款账户');
    expect((html.match(/Remittance Information \(optional\)/g) ?? [])).toHaveLength(1);

    expect(contractPaymentAccountRows(contract, {
      ...snapshot,
      accountNumber: '•••• 2401',
    }).find((row) => row.key === 'account-number')?.value).toBe('历史记录未保存完整账号');
  });

  it('shows only PayPal fields and falls back to the legacy payment method when no provider exists', () => {
    const paypalContract = {
      ...INITIAL_CONTRACTS[0],
      payoutProvider: 'Airwallex' as const,
      paymentMethod: 'BANK' as const,
    };
    const rows = contractPaymentAccountRows(paypalContract, paymentSnapshot('PayPal'));

    expect(contractPaymentChannelDisplayValue(paypalContract, paymentSnapshot('PayPal'))).toBe('PayPal');
    expect(rows.map((row) => row.label)).toEqual([
      'PayPal Username',
      'PayPal Email Address',
      'Transfer Note (optional)',
    ]);
    expect(rows.some((row) => row.label === 'Account Number')).toBe(false);
    expect(contractPaymentAccountRows(
      paypalContract,
      paymentSnapshot('PayMax'),
    ).some((row) => row.label === 'Account Number')).toBe(true);
    expect(contractPaymentChannelDisplayValue({
      ...paypalContract,
      payoutProvider: undefined,
      paymentMethod: 'BANK',
    }, null)).toBe('银行转账');
  });

  it('applies the recognized expiry, signed state, and isolated contract account snapshot', () => {
    const originalPaymentSnapshot = paymentSnapshot('Airwallex');
    const fields: ContractRecognitionField[] = [
      recognitionField('contractExpiry', '2026-12-31', { endDate: '2026-12-31', isLongTerm: false }),
      recognitionField('signatureStatus', '已签署', { signed: true }),
      recognitionField('accountName', 'Mina Kato Studio', 'Mina Kato Studio'),
      recognitionField('accountNumber', '0000004826', '0000004826'),
      recognitionField('beneficiaryBankName', 'Example Bank', 'Example Bank'),
    ];
    const contract = {
      ...INITIAL_CONTRACTS[0],
      lifecycle: 'UPLOADED_PENDING_CONFIRMATION' as const,
      signed: false,
      campaignEnd: '',
      paymentSnapshot: originalPaymentSnapshot,
      recognitionResults: fields,
      issues: [
        { id: 'recognition-review', label: '待确认', description: '待确认', severity: 'blocker' as const, source: '识别' },
        { id: 'signature', label: '待签署', description: '待签署', severity: 'blocker' as const, source: '签署' },
      ],
    } satisfies ContractRecord;

    const applied = applyConfirmedRecognitionToContract(contract, fields.map((field) => field.fieldKey));

    expect(applied).toMatchObject({
      campaignEnd: '2026-12-31',
      lifecycle: 'CONFIRMED',
      signed: true,
      recognizedPaymentDetails: {
        detectedChannel: 'BANK',
        accountName: 'Mina Kato Studio',
        accountNumber: '0000004826',
        beneficiaryBankName: 'Example Bank',
      },
    });
    expect(applied?.paymentSnapshot).toEqual(originalPaymentSnapshot);
    expect({
      payoutAccountId: applied?.payoutAccountId,
      payoutAccountVersion: applied?.payoutAccountVersion,
      payoutAccountFingerprint: applied?.payoutAccountFingerprint,
      accountName: applied?.accountName,
      accountFingerprint: applied?.accountFingerprint,
    }).toEqual({
      payoutAccountId: contract.payoutAccountId,
      payoutAccountVersion: contract.payoutAccountVersion,
      payoutAccountFingerprint: contract.payoutAccountFingerprint,
      accountName: contract.accountName,
      accountFingerprint: contract.accountFingerprint,
    });
    expect(applied?.issues.some((issue) => issue.id === 'signature')).toBe(false);
  });

  it('renders recognized mixed account groups without duplicating remittance information', () => {
    const rows = contractRecognizedAccountRows({
      detectedChannel: 'MIXED',
      accountName: 'Mina Kato Studio',
      accountNumber: '0000004826',
      remittanceInformation: 'Creator campaign',
      paypalUsername: 'mina.kato',
      paypalEmail: 'mina@example.com',
      transferNote: 'Summer campaign',
    });

    expect(rows.some((row) => row.label === 'Account Number')).toBe(true);
    expect(rows.some((row) => row.label === 'PayPal Email Address')).toBe(true);
    expect(rows.filter((row) => row.label === 'Remittance Information (optional)')).toHaveLength(1);
  });

  it('prefers recognized payment details and fills missing values from the frozen payout snapshot', () => {
    const snapshot = paymentSnapshot('Airwallex');
    const information = contractSignaturePaymentInformationFor({
      ...INITIAL_CONTRACTS[0],
      recognizedPaymentDetails: {
        detectedChannel: 'BANK',
        accountName: 'Recognized Creator Studio',
        accountNumber: '',
      },
    }, snapshot);

    expect(information.source).toBe('recognized-contract');
    expect(information.channel).toBe('银行转账');
    expect(information.fields.find((field) => field.label === 'Account Name')?.value).toBe('Recognized Creator Studio');
    expect(information.fields.find((field) => field.label === 'Account Number')?.value).toBe('50002401');
  });

  it('renders template-only cards and the paged field editor without ordinary contract controls', () => {
    const template = { ...INITIAL_CONTRACTS[1], uploadedByAccount: undefined } satisfies ContractRecord;
    const html = renderToStaticMarkup(
      <ContractDetailPage
        contract={template}
        canEditTemplate
        onUpdateContract={vi.fn()}
        onBack={vi.fn()}
        notify={vi.fn()}
      />,
    );

    expect(html).not.toContain('复制编号');
    expect(html).not.toContain('合同关系');
    expect(html).not.toContain('合同详情分类');
    expect(html).not.toContain('下载当前文件');
    expect(html).toContain('合同编辑器');
    expect((html.match(/role="tab"/g) ?? [])).toHaveLength(3);
    expect(html).toContain('通用字段');
    expect(html).toContain('银行转账字段');
    expect(html).toContain('PayPal 字段');
    expect((html.match(/data-template-output-field=/g) ?? [])).toHaveLength(3);
    expect((html.match(/>系统自动带入</g) ?? [])).toHaveLength(3);
    expect((html.match(/>生成时人工填写</g) ?? [])).toHaveLength(3);
    expect(html).not.toContain('>不生成<');
    expect(html).not.toContain('Campaign Period');
    expect(html).not.toContain('添加字段');
    expect(html).not.toContain('删除字段');
    expect(html).not.toContain('已启动');
    expect((html.match(/>停用模板</g) ?? [])).toHaveLength(1);
    expect(html).not.toContain('4/4');
    expect(html).not.toContain('7/7');
    expect(html).not.toContain('3/3');
    expect(html).toContain('系统内置');
    expect(html).toContain('签署状态');
    expect(html).toContain('不适用');
    expect(html.indexOf('合同类型')).toBeLessThan(html.indexOf('使用就绪度'));
    expect(html.indexOf('使用就绪度')).toBeLessThan(html.indexOf('上传者'));
  });

  it('renders a single start action for an inactive template', () => {
    const html = renderToStaticMarkup(
      <ContractDetailPage
        contract={{ ...INITIAL_CONTRACTS[1], templateStatus: 'INACTIVE' }}
        canEditTemplate
        onUpdateContract={vi.fn()}
        onBack={vi.fn()}
        notify={vi.fn()}
      />,
    );

    expect((html.match(/>启动模板</g) ?? [])).toHaveLength(1);
    expect(html).not.toContain('停用模板');
    expect(html).not.toContain('已停用');
    expect(html).not.toContain('下载当前文件');
  });

  it('maps known uploaders to names and preserves unknown uploader accounts', () => {
    const knownHtml = renderToStaticMarkup(
      <ContractDetailPage
        contract={{ ...INITIAL_CONTRACTS[1], uploadedByAccount: 'zhangshiyu' }}
        onBack={vi.fn()}
        notify={vi.fn()}
      />,
    );
    const unknownHtml = renderToStaticMarkup(
      <ContractDetailPage
        contract={{ ...INITIAL_CONTRACTS[1], uploadedByAccount: 'legacy.template.owner' }}
        onBack={vi.fn()}
        notify={vi.fn()}
      />,
    );

    expect(knownHtml).toContain('张诗雨');
    expect(knownHtml).toContain('zhangshiyu');
    expect(unknownHtml).toContain('legacy.template.owner');
    expect(unknownHtml).toContain('账号未收录在当前用户目录');
  });

  it('keeps ordinary contract metrics, relationship operations and inspector tabs unchanged', () => {
    const html = renderToStaticMarkup(
      <ContractDetailPage
        contract={INITIAL_CONTRACTS[0]}
        contracts={INITIAL_CONTRACTS}
        onBack={vi.fn()}
        notify={vi.fn()}
      />,
    );

    expect(html).toContain('复制编号');
    expect(html).toContain('下载当前文件');
    expect(html).toContain('付款就绪度');
    expect(html).toContain('合同金额');
    expect(html).toContain('关联请款项目');
    expect(html).toContain('合同关系');
    expect(html).toContain('合同摘要');
    expect(html).toContain('签署状态');
    expect(html).toContain('已签署');
    expect(html).toContain('付款与Invoice');
    expect(html).toContain('校验记录');
    expect(html).not.toContain('合同编辑器');
  });
});
