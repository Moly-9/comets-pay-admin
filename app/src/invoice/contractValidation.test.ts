import { describe, expect, it } from 'vitest';
import type { StructuredContract, StructuredContractIo } from '../contractDomain';
import {
  asCollaborationId,
  asContractId,
  asContractIoId,
  asCreatorId,
  asProjectId,
} from '../contractDomain';
import { INITIAL_CONTRACTS, type ContractRecord } from '../contracts';
import type { InvoiceDocumentModel } from '../types';
import { resolveInvoiceContract, validateInvoiceAgainstContract } from './contractValidation';

const structuredContract: StructuredContract = {
  contract_id: asContractId('contract-1'),
  contract_code: 'CON-001',
  project_id: asProjectId('project-1'),
  collaboration_id: asCollaborationId('collaboration-1'),
  creator_id: asCreatorId('creator-1'),
  advertiser: 'Comets International Limited',
  publisher: 'Synthetic Creator Limited',
  effective_date: '2026-08-01',
  signature_status: 'SIGNED',
  advertiser_signature_date: '2026-08-01',
  publisher_signature_date: '2026-08-01',
  payment_rules: {
    invoice_issue_period: null,
    payment_term: null,
    payment_method: {
      fieldKey: 'paymentMethod',
      label: 'Payment Method',
      rawValue: 'Bank transfer',
      normalizedValue: 'BANK_TRANSFER',
      sourceText: 'Payment Method: Bank transfer',
      pageNumber: 5,
      section: 'Payments',
      source: null,
      confidence: 1,
      status: 'CONFIRMED',
      candidates: [],
    },
    transfer_fee_bearer: null,
  },
  payout_account_snapshot: {
    beneficiary_account_name: 'Synthetic Creator Limited',
    bank_name: 'Example Bank',
    account_number_last4: '1234',
    swift_code: 'EXAMPLE1',
    iban_last4: '',
    paypal_username: '',
    paypal_email: '',
    remittance_information: '',
    status: 'CONFIRMED',
  },
};

const structuredIo: StructuredContractIo = {
  contract_io_id: asContractIoId('io-1'),
  io_number: 'IO-001',
  contract_id: structuredContract.contract_id,
  project_id: structuredContract.project_id,
  collaboration_id: structuredContract.collaboration_id,
  creator_id: structuredContract.creator_id,
  project_name: 'Synthetic Campaign',
  brand_name: 'Example Brand',
  campaign_start: '2026-08-01',
  campaign_end: '2026-08-31',
  platform: 'YouTube',
  channel_name: 'Synthetic Channel',
  channel_url: 'https://example.com/channel',
  project_total_fee: 300,
  currency: 'USD',
  deliverables: [],
  obligations: [],
};

const contract = {
  id: 'CON-001',
  projectId: 'project-1',
  creatorId: 'creator-1',
  engagementId: 'collaboration-1',
  extractionStage: 'applied',
  structuredContract,
  contractIOs: [structuredIo],
} as ContractRecord;

const invoice: InvoiceDocumentModel = {
  invoiceNumber: 'INV-001',
  invoiceDate: '2026-09-01',
  billTo: { name: 'Comets International Limited', address: 'Example Address' },
  creatorHandle: '@synthetic',
  creatorName: 'Synthetic Creator',
  creatorId: 'creator-1',
  collaborationId: 'collaboration-1',
  projectId: 'project-1',
  projectName: 'Different display name is allowed',
  contractId: 'contract-1',
  contractCode: 'CON-001',
  contractIoId: 'io-1',
  ioNumber: 'IO-001',
  contractLinkStatus: 'LINKED',
  from: { legalName: 'Synthetic Creator Limited', address: 'Example', phone: '000', email: 'creator@example.com' },
  currency: 'USD',
  items: [{ id: 'line-1', description: 'Service', quantity: 1, unitPrice: 300, lineTotal: 300 }],
  paymentMethod: 'bank',
  payment: {
    bankCountry: 'US',
    accountName: 'Synthetic Creator Limited',
    accountType: '',
    swiftCode: 'EXAMPLE1',
    accountNumber: '000000001234',
    iban: '',
    beneficiaryType: '',
    bankName: 'Example Bank',
    bankStreetAddress: '',
    bankCity: '',
    bankState: '',
    bankPostalCode: '',
    intermediaryBankCountry: '',
    intermediaryBankCode: '',
    transferRemarks: '',
    paypalUsername: '',
    paypalEmail: '',
  },
};

describe('Invoice contract linkage and validation', () => {
  it('resolves a contract only by stable project, collaboration, and creator IDs', () => {
    expect(resolveInvoiceContract([contract], {
      projectId: 'project-1',
      collaborationId: 'collaboration-1',
      creatorId: 'creator-1',
    }).status).toBe('LINKED');
    expect(resolveInvoiceContract([contract], {
      projectId: 'project-1',
      collaborationId: 'wrong-collaboration',
      creatorId: 'creator-1',
    }).status).toBe('NOT_LINKED_OPTIONAL');
  });

  it('keeps the built-in Mina demo contract reachable through stable IDs', () => {
    const result = resolveInvoiceContract(INITIAL_CONTRACTS, {
      projectId: 'PRJ-260727-03',
      collaborationId: 'collaboration-pay-001',
      creatorId: 'creator-mina',
    });
    expect(result.status).toBe('LINKED');
    expect(result.contract?.contractIOs?.[0].io_number).toBe('IO-260718-SB-01');
  });

  it('passes matching public fields and ignores project display-name differences', () => {
    const result = validateInvoiceAgainstContract(contract, invoice);
    expect(result.canGenerate).toBe(true);
    expect(result.items.some((entry) => entry.key === 'project')).toBe(false);
  });

  it('blocks generation but permits draft saving when a shared field differs', () => {
    const result = validateInvoiceAgainstContract(contract, {
      ...invoice,
      currency: 'EUR',
    });
    expect(result.canGenerate).toBe(false);
    expect(result.canSaveDraft).toBe(true);
    expect(result.blockers.map((entry) => entry.key)).toContain('currency');
  });

  it('allows an Invoice with no contract and labels it optional', () => {
    const result = validateInvoiceAgainstContract(null, invoice);
    expect(result).toMatchObject({
      linked: false,
      canGenerate: true,
      canSaveDraft: true,
      blockers: [],
    });
  });
});
