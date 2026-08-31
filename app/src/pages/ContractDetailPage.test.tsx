import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ContractRecognitionField, ContractSourceLocation } from '../contractRecognitionTypes';
import {
  INITIAL_CONTRACTS,
  applyConfirmedRecognitionToContract,
  getContractValidity,
  type ContractRecord,
  type ContractType,
} from '../contracts';
import {
  ContractDetailPage,
  contractExpiryDisplayValue,
  contractSummaryFieldsFor,
  recognitionCampaignEndValue,
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

describe('ContractDetailPage expiry presentation', () => {
  it('supports a request-scoped read-only contract detail', () => {
    const detailSource = readFileSync(new URL('./ContractDetailPage.tsx', import.meta.url), 'utf8');

    expect(detailSource).toContain('canEdit = true');
    expect(detailSource).toContain('const canEditCurrentContract = canEdit && (!contract.isTemplate || canEditTemplate)');
    expect(detailSource).toContain('recognitionLocked={recognitionApplied || !canEditCurrentContract}');
  });

  it.each(['INDEPENDENT', 'FRAMEWORK', 'IO'] as ContractType[])('replaces effective date with expiry while retaining Campaign Period for %s', (contractType) => {
    const fields = contractSummaryFieldsFor(contractType);

    expect(fields).toContainEqual({ key: 'campaignEnd', label: '到期时间' });
    expect(fields).toContainEqual({ key: 'campaignPeriod', label: 'Campaign Period' });
    expect(fields.some((field) => field.key === 'effectiveDate')).toBe(false);
  });

  it('derives the pending expiry preview from the Campaign Period end date', () => {
    const campaignPeriod = recognitionField(
      'campaignPeriod',
      'August 10, 2026 to September 17, 2026',
      { startDate: '2026-08-10', endDate: '2026-09-17' },
    );

    expect(recognitionCampaignEndValue(campaignPeriod)).toBe('2026-09-17');
    expect(recognitionCampaignEndValue({
      ...campaignPeriod,
      editedValue: 'August 12, 2026 to September 30, 2026',
      normalizedValue: '',
    })).toBe('2026-09-30');
    expect(recognitionCampaignEndValue(campaignPeriod, true)).toBe('长期有效');
    expect(recognitionCampaignEndValue(undefined)).toBe('待补充');
  });

  it('uses the same formal campaignEnd and long-term rules as contract-list validity', () => {
    expect(contractExpiryDisplayValue({ campaignEnd: '2026-09-30', isLongTerm: false })).toBe('2026-09-30');
    expect(contractExpiryDisplayValue({ campaignEnd: '', isLongTerm: false })).toBe('未设置');
    expect(contractExpiryDisplayValue({ campaignEnd: '2025-01-01', isLongTerm: true })).toBe('长期有效');
  });

  it('renders expiry as a read-only Campaign Period derivative without counting legacy effectiveDate', () => {
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

    expect(html).toContain('data-derived-from="campaignPeriod"');
    expect(html).toMatch(/aria-label="到期时间"[^>]*value="2026-09-17"/);
    expect(html).toContain('自动同步');
    expect(html).toContain('本页已确认 1/1 项');
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

  it('keeps contract header actions side by side when the title wraps', () => {
    const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

    expect(styles).toMatch(/\.contract-detail-page > \.page-heading-row > div:first-child\s*{[^}]*min-width:\s*0;/s);
    expect(styles).toMatch(/\.contract-detail-page > \.page-heading-row \.page-heading-actions\s*{[^}]*flex:\s*0 0 auto;[^}]*flex-wrap:\s*nowrap;/s);
    expect(styles).toMatch(/\.contract-detail-page \.page-heading-actions\s*{[^}]*grid-template-columns:\s*1fr 1fr;/s);
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
    expect((html.match(/data-template-output-field=/g) ?? [])).toHaveLength(4);
    expect((html.match(/>系统自动带入</g) ?? [])).toHaveLength(4);
    expect((html.match(/>生成时人工填写</g) ?? [])).toHaveLength(4);
    expect((html.match(/>不生成</g) ?? [])).toHaveLength(4);
    expect(html).not.toContain('添加字段');
    expect(html).not.toContain('删除字段');
    expect(html).not.toContain('已启动');
    expect((html.match(/>停用模板</g) ?? [])).toHaveLength(1);
    expect(html).not.toContain('4/4');
    expect(html).not.toContain('7/7');
    expect(html).not.toContain('3/3');
    expect(html).toContain('系统内置');
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
    expect(html).toContain('付款与Invoice');
    expect(html).toContain('校验记录');
    expect(html).not.toContain('合同编辑器');
  });
});
