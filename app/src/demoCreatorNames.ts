export type DemoCreatorNameKind = 'real' | 'dis' | 'acc';

const DEMO_CREATOR_NAME_SUFFIX = /\s+(?:real|dis|acc)$/i;

export const demoCreatorName = (
  value: string,
  kind: DemoCreatorNameKind,
) => {
  const normalized = value.trim().replace(DEMO_CREATOR_NAME_SUFFIX, '').trim();
  return normalized ? `${normalized} ${kind}` : '';
};

export const demoRealName = (value: string) => demoCreatorName(value, 'real');

export const demoDisplayName = (value: string) => demoCreatorName(value, 'dis');

export const demoAccountName = (value: string) => demoCreatorName(value, 'acc');
