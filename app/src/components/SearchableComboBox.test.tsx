import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  filterSearchableOptions,
  SearchableComboBox,
  type SearchableOption,
} from './SearchableComboBox';

const options: SearchableOption[] = [{
  value: 'creator-1',
  label: 'Camila Costa',
  selectedLabel: 'Camila Costa · @camila.beauty · Instagram',
  description: '@camila.beauty · Instagram',
  searchText: 'https://instagram.com/camila.beauty Sample Studio Ltd.',
}];

describe('SearchableComboBox', () => {
  it('matches label, channel metadata, profile link, and additional search terms', () => {
    expect(filterSearchableOptions(options, 'camila costa')).toEqual(options);
    expect(filterSearchableOptions(options, '@camila.beauty')).toEqual(options);
    expect(filterSearchableOptions(options, 'instagram.com')).toEqual(options);
    expect(filterSearchableOptions(options, 'sample studio')).toEqual(options);
    expect(filterSearchableOptions(options, 'not-found')).toEqual([]);
  });

  it('shows the complete selected presentation and disables clear in read-only mode', () => {
    const html = renderToStaticMarkup(
      <SearchableComboBox
        ariaLabel="合作达人"
        className="creator-search-combobox"
        value="creator-1"
        options={options}
        placeholder="搜索达人"
        disabled
        onChange={() => undefined}
        onClear={() => undefined}
      />,
    );

    expect(html).toContain('contract-search-combobox creator-search-combobox');
    expect(html).toContain('value="Camila Costa · @camila.beauty · Instagram"');
    expect(html).toMatch(/<button[^>]*aria-label="清除合作达人"[^>]*disabled/);
  });

  it('uses the shared creator identity card treatment for creator search options', () => {
    const css = readFileSync(new URL('./CreatorSearchOptions.css', import.meta.url), 'utf8');

    expect(css).toMatch(/\.creator-search-combobox \.contract-search-option\s*\{[\s\S]*?min-height:\s*64px;/);
    expect(css).toMatch(/\.creator-search-combobox \.contract-search-option\.is-selected[\s\S]*?background:\s*#f6fbf8;/);
    expect(css).toMatch(/\.creator-search-combobox \.contract-search-option \.avatar-sm,[\s\S]*?width:\s*38px;/);
    expect(css).toMatch(/\.creator-option\.creator-option-selected,[\s\S]*?background:\s*#f6fbf8;/);
  });
});
