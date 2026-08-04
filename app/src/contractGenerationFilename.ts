import type { ContractGenerationModel } from './contracts';

export const contractGenerationFilename = (
  model: ContractGenerationModel,
  version: number,
  extension: 'docx' | 'pdf',
) => {
  const creator = model.creatorHandle.replace(/^@/, '').replace(/[^\w-]+/g, '-') || 'creator';
  const code = model.contractNumber.replace(/[^\w-]+/g, '-') || 'contract';
  return `${code}-${creator}-v${version}.${extension}`;
};
