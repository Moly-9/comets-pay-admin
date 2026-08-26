import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sortRequestResourcePickerOptions } from './MediaPaymentProjectsPage';

describe('new payment request resource picker', () => {
  it('shows selectable and selected resources before disabled resources', () => {
    const options = [
      { value: 'disabled-one', label: '置灰 1', description: '', selected: false, disabled: true },
      { value: 'available-one', label: '可选 1', description: '', selected: false },
      { value: 'selected-one', label: '已选 1', description: '', selected: true, disabled: true },
      { value: 'disabled-two', label: '置灰 2', description: '', selected: false, disabled: true },
      { value: 'available-two', label: '可选 2', description: '', selected: false, disabled: false },
    ];

    expect(sortRequestResourcePickerOptions(options).map((option) => option.value)).toEqual([
      'available-one',
      'selected-one',
      'available-two',
      'disabled-one',
      'disabled-two',
    ]);
  });

  it('keeps the creator search icon and input on one horizontal row', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    const searchStyles = css.slice(
      css.indexOf('.creator-picker-search {'),
      css.indexOf('.creator-picker-result-count {'),
    );

    expect(searchStyles).toContain('grid-template-columns: auto minmax(0, 1fr)');
    expect(searchStyles).toContain('align-items: center');
    expect(searchStyles).toContain('height: 40px');
    expect(searchStyles).toContain('line-height: 40px');
    expect(searchStyles).toContain('white-space: nowrap');
  });
});
