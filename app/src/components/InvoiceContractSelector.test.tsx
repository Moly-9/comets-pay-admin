import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { INITIAL_CONTRACTS } from '../contracts';
import { InvoiceContractSelector } from './InvoiceContractSelector';

describe('InvoiceContractSelector', () => {
  it('renders the shared contract name, code, amount and selection summary', () => {
    const contracts = INITIAL_CONTRACTS.slice(0, 2).map((contract, index) => ({
      ...contract,
      contractId: (`contract-shared-${index}`) as never,
      name: `Shared Contract ${index + 1}`,
      id: `CON-SHARED-${index + 1}`,
      currency: 'USD',
      totalFee: 1200 + index * 300,
    }));
    const html = renderToStaticMarkup(
      <InvoiceContractSelector
        contracts={contracts}
        selectedContractIds={[contracts[0].contractId!]}
        onToggle={() => undefined}
        labelId="shared-contract-label"
        helperText="Shared helper"
        emptyText="No contracts"
      />,
    );

    expect(html).toContain('role="group"');
    expect(html).toContain('aria-labelledby="shared-contract-label"');
    expect(html).toContain('已选 1 份');
    expect(html).toContain('Shared Contract 1');
    expect(html).toContain('CON-SHARED-1 · USD 1,200');
    expect(html).toContain('checked=""');
    expect(html.indexOf('Shared Contract 1')).toBeLessThan(html.indexOf('CON-SHARED-1'));
  });

  it('renders the optional no-contract state', () => {
    const html = renderToStaticMarkup(
      <InvoiceContractSelector
        contracts={[]}
        selectedContractIds={[]}
        onToggle={() => undefined}
        labelId="empty-contract-label"
        helperText="Contracts are optional"
        emptyText="No eligible contracts; continue without one."
      />,
    );

    expect(html).toContain('未关联合同（非必填）');
    expect(html).toContain('No eligible contracts; continue without one.');
    expect(html).not.toContain('role="group"');
  });
});
