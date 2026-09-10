import { AIRWALLEX_SCHEMA_COUNTRIES } from './airwallexFormSchema';
import type { CreatorSocialAccount } from './types';

const normalizeCountryLookupValue = (value: string) => value
  .trim()
  .replace(/[.。]+$/g, '')
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('en-US');

const COUNTRY_NAME_OVERRIDES = new Map<string, string>([
  ['china', '中国'],
  ['people\'s republic of china', '中国'],
  ['pr china', '中国'],
  ['usa', '美国'],
  ['u.s.a', '美国'],
  ['united states of america', '美国'],
  ['uk', '英国'],
  ['u.k', '英国'],
]);

const COUNTRY_NAME_BY_ALIAS = new Map<string, string>([
  ...AIRWALLEX_SCHEMA_COUNTRIES.flatMap((country) => [
    [normalizeCountryLookupValue(country.value), country.label],
    [normalizeCountryLookupValue(country.label), country.label],
    [normalizeCountryLookupValue(country.englishLabel), country.label],
  ] as Array<[string, string]>),
  ...[...COUNTRY_NAME_OVERRIDES].map(([alias, label]): [string, string] => [
    normalizeCountryLookupValue(alias),
    label,
  ]),
]);

const COUNTRY_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’()\-]{0,55}$/u;

export const creatorRegionFromContactAddress = (address: string) => {
  const segments = address
    .split(/[,，\n\r]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const candidate = segments[segments.length - 1]?.replace(/[.。]+$/g, '').trim() ?? '';
  if (!candidate || !COUNTRY_NAME_PATTERN.test(candidate)) return '';
  return COUNTRY_NAME_BY_ALIAS.get(normalizeCountryLookupValue(candidate)) ?? candidate;
};

export const creatorNameFromPrimaryHandle = (
  socialAccounts: readonly CreatorSocialAccount[],
) => {
  const handle = socialAccounts[0]?.handle.trim() ?? '';
  if (!handle) return '';
  return handle.startsWith('@') ? handle : `@${handle}`;
};

export const isCreatorNameAutoDerived = (
  name: string,
  socialAccounts: readonly CreatorSocialAccount[],
) => {
  const normalizedName = name.trim();
  return !normalizedName || normalizedName === creatorNameFromPrimaryHandle(socialAccounts);
};

export const creatorInitialsFromName = (name: string) => {
  const normalized = name.trim().replace(/^@+/, '');
  if (!normalized) return 'NA';
  const parts = normalized.split(/[\s._-]+/).filter(Boolean);
  if (parts.length > 1) {
    return parts.map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }
  return normalized.slice(0, 2).toUpperCase();
};
