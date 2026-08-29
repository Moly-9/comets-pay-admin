import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  FileCheck2,
  FileText,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, NoticeBanner, PageHeading } from '../components/Common';
import { paymentProviderDisplayName } from '../components/PaymentProviderBadge';
import {
  formatContractMoney,
  getContractReadiness,
  getContractValidity,
  isContractAvailableForNewAssociation,
  type ContractRecord,
} from '../contracts';
import { PM_USERS, type SystemUser } from '../data';
import {
  PAYMENT_PROJECT_INVOICES,
  generatePaymentListItem,
  invoiceMatchPassed,
  matchInvoiceToContract,
  type PaymentProjectInvoice,
} from '../paymentProject';
import type { RequestProjectSummary } from './RequestProjectDetailPage';

type Notify = (title: string, message: string) => void;

const STEPS = ['项目资料', '选择Invoice', '生成付款清单'];

export function RequestProjectCreatePage({
  contracts,
  onCancel,
  onCreated,
  notify,
  currentUser,
}: {
  contracts: ContractRecord[];
  onCancel: () => void;
  onCreated: (request: RequestProjectSummary) => void;
  notify: Notify;
  currentUser: SystemUser;
}) {
  const [step, setStep] = useState(0);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [brand, setBrand] = useState('');
  const [media, setMedia] = useState<string>(currentUser.name);
  const [pm, setPM] = useState<string>(PM_USERS[0]?.name ?? '');
  const [reason, setReason] = useState('');

  const selectedContract = contracts.find((contract) => contract.id === selectedContractId) ?? null;
  const selectedInvoice = PAYMENT_PROJECT_INVOICES.find((invoice) => invoice.id === selectedInvoiceId) ?? null;
  const matchFields = useMemo(() => (
    selectedContract && selectedInvoice
      ? matchInvoiceToContract(selectedContract, selectedInvoice)
      : []
  ), [selectedContract, selectedInvoice]);
  const matchPassed = !selectedContract || invoiceMatchPassed(matchFields);
  const paymentItem = selectedInvoice && matchPassed
    ? generatePaymentListItem(selectedContract, selectedInvoice)
    : null;

  const selectContract = (contract: ContractRecord) => {
    if (!getContractReadiness(contract).ready || !isContractAvailableForNewAssociation(contract)) return;
    setSelectedContractId(contract.id);
    setSelectedInvoiceId('');
    setProjectName(contract.project);
    setBrand(contract.brand);
    setReason(`支付${contract.project}的KOL内容制作、发布及授权费用。`);
  };

  const clearContract = () => {
    setSelectedContractId('');
    setSelectedInvoiceId('');
  };

  const createRequest = () => {
    if (!selectedInvoice || !paymentItem || !matchPassed || !projectName.trim() || !brand.trim()) return;
    const suffix = Date.now().toString().slice(-3);
    const requestId = `PRJ-260725-${suffix}`;
    const amount = `${paymentItem.sourceCurrency} ${paymentItem.amount.toLocaleString('en-US')}`;
    const hasContract = Boolean(selectedContract);
    const request: RequestProjectSummary = {
      id: requestId,
      project: projectName.trim(),
      brand: brand.trim(),
      media: media.trim() || currentUser.name,
      pm,
      amount,
      contracts: hasContract ? 1 : 0,
      invoices: 1,
      paymentOrder: paymentItem.id,
      status: '待审批',
      filter: 'pending',
      generatedDetail: {
        brand: brand.trim(),
        reason: reason.trim(),
        contractId: selectedContract?.id ?? '未关联',
        contractName: selectedContract?.name ?? '本次请款未关联合同',
        contractAmount: selectedContract ? formatContractMoney(selectedContract) : '—',
        contractStatus: selectedContract ? '已匹配' : '未关联',
        invoiceId: selectedInvoice.id,
        invoiceAmount: amount,
        invoiceStatus: selectedContract ? '已校验' : '待审批',
        paymentListId: paymentItem.id,
        paymentListStatus: '已生成',
        payee: paymentItem.beneficiaryName,
        provider: paymentItem.provider,
        beneficiaryId: paymentItem.beneficiaryId,
        feePolicy: paymentItem.feePolicy,
      },
    };
    onCreated(request);
  };

  return (
    <div className="page-stack request-create-page">
      <button className="project-back-button" type="button" onClick={onCancel}>
        <ArrowLeft size={17} />
        返回请款项目
      </button>
      <PageHeading
        title="新建付款项目"
        subtitle="填写项目资料，可按需关联合同；选择Invoice后生成付款清单并提交审批。"
      />

      <ol className="request-create-steps" aria-label="新建付款项目进度">
        {STEPS.map((label, index) => (
          <li className={index < step ? 'is-complete' : index === step ? 'is-current' : ''} key={label}>
            <span>{index < step ? <Check size={15} /> : index + 1}</span>
            <strong>{label}</strong>
            {index < STEPS.length - 1 ? <i /> : null}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <>
          <NoticeBanner>合同不是提交审批的必选项。未关联合同时仍可继续选择Invoice、生成付款清单并提交审批，合同可在后续补充。</NoticeBanner>
          <section className="request-create-section">
            <header><div><h2>付款项目信息</h2><p>填写本次付款的项目归属、负责人和付款说明。</p></div></header>
            <div className="request-create-form">
              <label><span>项目名称</span><input aria-label="项目名称" placeholder="请输入项目名称" value={projectName} onChange={(event) => setProjectName(event.target.value)} /></label>
              <label><span>品牌 / 客户</span><input aria-label="品牌或客户" placeholder="请输入品牌或客户名称" value={brand} onChange={(event) => setBrand(event.target.value)} /></label>
              <label><span>项目媒介</span><input aria-label="项目媒介" value={media} onChange={(event) => setMedia(event.target.value)} /></label>
              <label>
                <span>负责 PM</span>
                <select aria-label="负责 PM" value={pm} onChange={(event) => setPM(event.target.value)}>
                  {PM_USERS.map((user) => <option key={user.account} value={user.name}>{user.name}</option>)}
                </select>
              </label>
              <label className="request-create-form-wide"><span>付款事由</span><textarea aria-label="付款事由" placeholder="请说明本次付款用途" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            </div>
          </section>

          <section className="request-create-section">
            <header>
              <div><h2>关联合同 <span className="request-optional-label">选填</span></h2><p>选择后会带入合同字段并在下一步与Invoice匹配；也可以暂不关联。</p></div>
              {selectedContract ? <button className="text-link" type="button" onClick={clearContract}>取消关联</button> : <span className="request-optional-state">可后续补充</span>}
            </header>
            <div className="payment-contract-options">
              {contracts.map((contract) => {
                const readiness = getContractReadiness(contract);
                const validity = getContractValidity(contract);
                const available = readiness.ready && isContractAvailableForNewAssociation(contract);
                const selected = selectedContractId === contract.id;
                return (
                  <button
                    className={`payment-contract-option ${selected ? 'is-selected' : ''} ${available ? '' : 'is-disabled'}`}
                    type="button"
                    aria-pressed={selected}
                    disabled={!available}
                    key={contract.id}
                    onClick={() => selectContract(contract)}
                  >
                    <span className="payment-contract-select">{selected ? <CheckCircle2 size={20} /> : <Circle size={20} />}</span>
                    <span className="payment-contract-copy">
                      <span><strong>{contract.name}</strong><small>{contract.id} · {contract.ioId}</small></span>
                      <span><small>Publisher</small><strong>{contract.publisher || '待补充'}</strong></span>
                      <span><small>项目金额</small><strong>{formatContractMoney(contract)}</strong></span>
                    </span>
                    <span className={`payment-contract-state ${available ? 'is-ready' : ''}`}>{available ? '可选择' : validity.expired ? '合同已失效' : contract.isTemplate ? '参考模板' : readiness.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <section className="request-create-context">
            <FileText size={18} />
            {selectedContract ? (
              <span><small>当前合同</small><strong>{selectedContract.name}</strong><em>{formatContractMoney(selectedContract)}</em></span>
            ) : (
              <span><small>关联合同</small><strong>未关联（选填）</strong><em>不影响提交审批</em></span>
            )}
          </section>

          <section className="request-create-section">
            <header>
              <div>
                <h2>选择Invoice</h2>
                <p>{selectedContract ? '系统将合同、Invoice和合同账户快照逐字段比较。' : '本项目未关联合同，可直接选择Invoice生成付款清单。'}</p>
              </div>
            </header>
            <div className="payment-invoice-options">
              {PAYMENT_PROJECT_INVOICES.map((invoice) => {
                const selected = selectedInvoiceId === invoice.id;
                const sameContract = selectedContract ? invoice.contractId === selectedContract.id : false;
                return (
                  <button
                    className={`payment-invoice-option ${selected ? 'is-selected' : ''}`}
                    type="button"
                    aria-pressed={selected}
                    key={invoice.id}
                    onClick={() => setSelectedInvoiceId(invoice.id)}
                  >
                    <span>{selected ? <CheckCircle2 size={19} /> : <ReceiptText size={19} />}</span>
                    <span><strong>{invoice.id}</strong><small>{invoice.creator} · {invoice.currency} {invoice.total.toLocaleString('en-US')}</small></span>
                    <em className={sameContract || !selectedContract ? 'invoice-contract-match' : ''}>
                      {selectedContract ? (sameContract ? '关联当前合同' : '其他合同') : '可独立提交'}
                    </em>
                  </button>
                );
              })}
            </div>
          </section>

          {selectedInvoice && selectedContract ? (
            <section className="request-create-section invoice-match-section">
              <header>
                <div><h2>合同与Invoice匹配结果</h2><p>所有阻断字段通过后才能生成付款清单。</p></div>
                <span className={`invoice-match-summary ${matchPassed ? 'is-passed' : 'is-failed'}`}>
                  {matchPassed ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                  {matchFields.filter((field) => field.result === 'match').length}/{matchFields.length} 项通过
                </span>
              </header>
              <div className="table-scroll">
                <table className="data-table invoice-match-table">
                  <thead><tr><th>校验字段</th><th>合同值</th><th>Invoice值</th><th>结果</th></tr></thead>
                  <tbody>
                    {matchFields.map((field) => (
                      <tr className={field.result === 'mismatch' ? 'match-row-error' : ''} key={field.key}>
                        <td><strong>{field.label}</strong></td>
                        <td>{field.contractValue}</td>
                        <td>{field.invoiceValue}</td>
                        <td>
                          <span className={`match-result match-result-${field.result}`}>
                            {field.result === 'match' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                            {field.message}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {selectedInvoice && !selectedContract ? (
            <NoticeBanner>本项目未关联合同，因此不执行合同与Invoice匹配；当前Invoice仍可生成付款清单并提交审批。</NoticeBanner>
          ) : null}
        </>
      ) : null}

      {step === 2 && selectedInvoice && paymentItem ? (
        <>
          <NoticeBanner>
            {selectedContract
              ? '付款清单已根据通过校验的合同与Invoice自动生成。最终模板版式将在后续付款清单模板接入后替换，字段关系保持不变。'
              : '付款清单已根据Invoice和收款账户资料生成。合同未关联，不影响本次提交审批，可在后续补充。'}
          </NoticeBanner>
          <section className="request-create-section payment-list-preview">
            <header>
              <div><h2>付款清单预览</h2><p>{paymentItem.id} · 1笔付款</p></div>
              <span className="payment-list-ready"><ShieldCheck size={17} />{selectedContract ? '资料已匹配' : '可提交审批'}</span>
            </header>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>收款人</th><th>合同 / IO（选填）</th><th>Invoice</th><th>渠道账户</th><th>金额</th><th>费用承担</th></tr></thead>
                <tbody>
                  <tr>
                    <td><strong>{paymentItem.beneficiaryName}</strong></td>
                    <td>{paymentItem.contractId}<small className="cell-subtext">{paymentItem.ioId}</small></td>
                    <td>{paymentItem.invoiceId}</td>
                    <td>{paymentProviderDisplayName(paymentItem.provider)}<small className="cell-subtext">{paymentItem.beneficiaryId}</small></td>
                    <td><strong>{paymentItem.sourceCurrency} {paymentItem.amount.toLocaleString('en-US')}</strong></td>
                    <td>{paymentItem.feePolicy}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="payment-list-lineage">
              <span><FileCheck2 size={16} />{selectedContract ? '合同金额与费用规则' : '合同未关联（选填）'}</span>
              <i />
              <span><ReceiptText size={16} />Invoice主体与应付金额</span>
              <i />
              <span><WalletCards size={16} />付款清单执行字段</span>
            </div>
          </section>
        </>
      ) : null}

      <footer className="request-create-footer">
        <div>
          {step > 0 ? <Button variant="ghost" onClick={() => setStep((current) => current - 1)}>上一步</Button> : <Button variant="ghost" onClick={onCancel}>取消</Button>}
        </div>
        <div>
          {step === 0 ? <Button disabled={!projectName.trim() || !brand.trim()} disabledReason={!projectName.trim() ? '请先填写项目名称。' : '请先填写品牌名称。'} onClick={() => setStep(1)}>下一步：选择Invoice</Button> : null}
          {step === 1 ? <Button disabled={!selectedInvoice || !matchPassed} disabledReason={!selectedInvoice ? '请先选择 Invoice。' : 'Invoice 与合同资料尚未通过匹配校验。'} onClick={() => setStep(2)}>生成付款清单</Button> : null}
          {step === 2 ? <Button icon={<WalletCards size={17} />} onClick={createRequest}>创建并提交审批</Button> : null}
        </div>
      </footer>
    </div>
  );
}
