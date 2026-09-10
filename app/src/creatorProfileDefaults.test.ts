import { describe, expect, it } from 'vitest';
import {
  creatorInitialsFromName,
  creatorNameFromPrimaryHandle,
  creatorRegionFromContactAddress,
  isCreatorNameAutoDerived,
} from './creatorProfileDefaults';
import type { CreatorSocialAccount } from './types';

const accounts = (firstHandle: string, secondHandle = '@secondary'): CreatorSocialAccount[] => [
  { id: 'social-1', platform: 'Instagram', handle: firstHandle, profileUrl: '' },
  { id: 'social-2', platform: 'TikTok', handle: secondHandle, profileUrl: '' },
];

describe('creator profile defaults', () => {
  it('从第一个社媒账号生成带 @ 的默认达人名称', () => {
    expect(creatorNameFromPrimaryHandle(accounts('luna.creator'))).toBe('@luna.creator');
    expect(creatorNameFromPrimaryHandle(accounts('@luna.creator'))).toBe('@luna.creator');
    expect(creatorNameFromPrimaryHandle(accounts('', '@fallback'))).toBe('');
    expect(isCreatorNameAutoDerived('', accounts('@luna.creator'))).toBe(true);
    expect(isCreatorNameAutoDerived('@luna.creator', accounts('@luna.creator'))).toBe(true);
    expect(isCreatorNameAutoDerived('Luna Jones', accounts('@luna.creator'))).toBe(false);
  });

  it('自动名称生成头像缩写时忽略 @', () => {
    expect(creatorInitialsFromName('@luna.creator')).toBe('LC');
    expect(creatorInitialsFromName('@lunajones')).toBe('LU');
    expect(creatorInitialsFromName('Luna Jones')).toBe('LJ');
  });

  it('从联系地址末尾识别已知国家并映射为系统中文地区', () => {
    expect(creatorRegionFromContactAddress('New York, NY, United States')).toBe('美国');
    expect(creatorRegionFromContactAddress('Shibuya-ku, Tokyo, Japan')).toBe('日本');
    expect(creatorRegionFromContactAddress('Wan Chai, Hong Kong, China')).toBe('中国');
    expect(creatorRegionFromContactAddress('London\nUnited Kingdom')).toBe('英国');
  });

  it('保留未知合法国家名，并拒绝没有末尾国家名的地址', () => {
    expect(creatorRegionFromContactAddress('Montreal, Quebec, Canada')).toBe('Canada');
    expect(creatorRegionFromContactAddress('Dubai, United Arab Emirates')).toBe('United Arab Emirates');
    expect(creatorRegionFromContactAddress('123 Market Street, New York 10001')).toBe('');
    expect(creatorRegionFromContactAddress('')).toBe('');
  });
});
