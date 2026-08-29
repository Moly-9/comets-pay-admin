import type { ContractId } from '../businessWorkflow';
import { formatContractMoney, type ContractRecord } from '../contracts';

export function InvoiceContractSelector({
  contracts,
  selectedContractIds,
  onToggle,
  labelId,
  heading = '关联合同（非必填）',
  helperText,
  emptyText,
}: {
  contracts: ContractRecord[];
  selectedContractIds: ContractId[];
  onToggle: (contractId: ContractId) => void;
  labelId: string;
  heading?: string;
  helperText: string;
  emptyText: string;
}) {
  return (
    <div className="invoice-contract-selector">
      <div className="invoice-contract-coverage-head">
        <div>
          <strong id={labelId}>{heading}</strong>
          <span>{helperText}</span>
        </div>
        <em>{selectedContractIds.length ? `已选 ${selectedContractIds.length} 份` : '未关联合同（非必填）'}</em>
      </div>
      {contracts.length ? (
        <div className="invoice-contract-options" role="group" aria-labelledby={labelId}>
          {contracts.map((contract) => {
            const contractId = contract.contractId!;
            return (
              <label key={String(contractId)}>
                <input
                  type="checkbox"
                  checked={selectedContractIds.includes(contractId)}
                  onChange={() => onToggle(contractId)}
                />
                <span>
                  <strong>{contract.name}</strong>
                  <small>{contract.id} · {formatContractMoney(contract)}</small>
                </span>
              </label>
            );
          })}
        </div>
      ) : <p className="invoice-contract-selector-empty">{emptyText}</p>}
    </div>
  );
}
