import type {
  ContractFieldStatus,
  ContractRecognitionField,
  StructuredContractDeliverable,
  StructuredContractObligation,
} from './contractRecognitionTypes';

declare const idBrand: unique symbol;

export type BrandedId<Entity extends string> = string & { readonly [idBrand]: Entity };
export type ContractId = BrandedId<'contract_id'>;
export type ContractIoId = BrandedId<'contract_io_id'>;
export type ProjectId = BrandedId<'project_id'>;
export type CollaborationId = BrandedId<'collaboration_id'>;
export type CreatorId = BrandedId<'creator_id'>;

export const asContractId = (value: string) => value as ContractId;
export const asContractIoId = (value: string) => value as ContractIoId;
export const asProjectId = (value: string) => value as ProjectId;
export const asCollaborationId = (value: string) => value as CollaborationId;
export const asCreatorId = (value: string) => value as CreatorId;

export type ContractPaymentRules = {
  invoice_issue_period: ContractRecognitionField | null;
  payment_term: ContractRecognitionField | null;
  payment_method: ContractRecognitionField | null;
  transfer_fee_bearer: ContractRecognitionField | null;
};

export type ContractPayoutAccountSnapshot = {
  beneficiary_account_name: string;
  bank_name: string;
  account_number_last4: string;
  swift_code: string;
  iban_last4: string;
  paypal_username: string;
  paypal_email: string;
  remittance_information: string;
  status: ContractFieldStatus;
};

export type StructuredContract = {
  contract_id: ContractId;
  contract_code: string;
  project_id: ProjectId;
  collaboration_id: CollaborationId;
  creator_id: CreatorId;
  advertiser: string;
  publisher: string;
  effective_date: string;
  signature_status: 'UNSIGNED' | 'PARTIALLY_SIGNED' | 'SIGNED' | 'UNKNOWN';
  advertiser_signature_date: string;
  publisher_signature_date: string;
  payment_rules: ContractPaymentRules;
  payout_account_snapshot: ContractPayoutAccountSnapshot;
};

export type StructuredContractIo = {
  contract_io_id: ContractIoId;
  io_number: string;
  contract_id: ContractId;
  project_id: ProjectId;
  collaboration_id: CollaborationId;
  creator_id: CreatorId;
  project_name: string;
  brand_name: string;
  campaign_start: string;
  campaign_end: string;
  platform: string;
  channel_name: string;
  channel_url: string;
  project_total_fee: number | null;
  currency: string;
  deliverables: StructuredContractDeliverable[];
  obligations: StructuredContractObligation[];
};

export const UNASSIGNED_CONTRACT_ID = asContractId('prototype:contract:unassigned');
export const UNASSIGNED_CONTRACT_IO_ID = asContractIoId('prototype:contract-io:unassigned');
