import type {
  ContractRecord,
  ContractSignatureRequest,
  ContractSignatureSendResult,
} from './contracts';

export type ContractSignatureSender = (
  request: ContractSignatureRequest,
) => Promise<ContractSignatureSendResult>;

export const createContractSignatureRequest = (
  contract: ContractRecord,
  input: Pick<
    ContractSignatureRequest,
    'creatorDisplayName' | 'amount' | 'paymentInformation' | 'signerName' | 'requestedAt'
  >,
): ContractSignatureRequest => {
  const primaryDocument = contract.sourceDocuments?.[0];
  return {
    contractId: String(contract.contractId ?? contract.id),
    contractCode: contract.id,
    creatorId: String(contract.creatorId ?? ''),
    creatorDisplayName: input.creatorDisplayName,
    advertiser: contract.advertiser,
    publisher: contract.publisher,
    amount: input.amount,
    feeBearer: contract.feeBearer,
    paymentInformation: {
      ...input.paymentInformation,
      fields: input.paymentInformation.fields.map((field) => ({ ...field })),
    },
    signerName: input.signerName.trim(),
    documentReference: {
      documentId: primaryDocument?.id,
      fileName: primaryDocument?.fileName ?? contract.sourceName,
      documentUrl: primaryDocument?.documentUrl ?? contract.documentUrl,
    },
    requestedAt: input.requestedAt,
  };
};

/** Replaceable local adapter for a future creator-side / DocuSign integration. */
export const simulateDocuSignContractSend: ContractSignatureSender = async (request) => {
  await Promise.resolve();
  if (!request.signerName.trim()) return { ok: false, error: '请填写签署人。' };
  if (!request.contractId || !request.creatorId) {
    return { ok: false, error: '合同或达人关联信息不完整，无法发送签署。' };
  }
  if (!request.documentReference.fileName || !request.documentReference.documentUrl) {
    return { ok: false, error: '合同文件缺失，请重新上传后再发送。' };
  }
  const envelopeSuffix = `${request.contractCode}-${request.requestedAt}`
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
  return {
    ok: true,
    envelopeId: `DOCUSIGN-DEMO-${envelopeSuffix}`,
    sentAt: request.requestedAt,
  };
};

export const sendContractSignatureRequest = async (
  request: ContractSignatureRequest,
  sender: ContractSignatureSender = simulateDocuSignContractSend,
) => sender(request);
