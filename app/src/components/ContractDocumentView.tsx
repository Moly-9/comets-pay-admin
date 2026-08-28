import type { ContractRecord } from '../contracts';
import { formatContractMoney } from '../contracts';
import { formatCreatorHandle } from '../creatorSearchOptions';

const paymentMethodLabel = (contract: ContractRecord) => {
  if (contract.paymentMethod === 'PAYPAL') return 'PayPal';
  if (contract.paymentMethod === 'BANK') return 'Bank transfer';
  return 'To be confirmed';
};

const feeBearerLabel = (contract: ContractRecord) => {
  if (contract.feeBearer === 'ADVERTISER') return 'Advertiser';
  if (contract.feeBearer === 'PUBLISHER') return 'Publisher';
  if (contract.feeBearer === 'SHARED') return 'Shared by both parties';
  return 'To be confirmed';
};

export function ContractDocumentView({
  contract,
  ariaLabel = '合同全文',
}: {
  contract: ContractRecord;
  ariaLabel?: string;
}) {
  const channelName = formatCreatorHandle(
    contract.creatorHandle ?? contract.channelName,
    contract.creatorPlatform ?? contract.platform,
  );
  const campaignPeriod = contract.campaignStart && contract.campaignEnd
    ? `${contract.campaignStart} to ${contract.campaignEnd}`
    : 'To be confirmed';

  return (
    <article className="contract-paper" aria-label={ariaLabel}>
      <header className="contract-paper-title">
        <p>COMETS INTERNATIONAL LIMITED</p>
        <h2>SOCIAL MEDIA PROMOTION SERVICES AGREEMENT</h2>
        <span>{contract.name}</span>
      </header>

      <dl className="contract-paper-reference">
        <div><dt>Contract No.</dt><dd>{contract.id}</dd></div>
        <div><dt>Insertion Order</dt><dd>{contract.ioId}</dd></div>
        <div><dt>Effective Date</dt><dd>{contract.effectiveDate || 'To be confirmed'}</dd></div>
      </dl>

      <section>
        <h3>Parties</h3>
        <p>
          This Social Media Promotion Services Agreement (the “Agreement”) is entered into by and between
          <strong> {contract.advertiser || 'the Advertiser'} </strong>
          (the “Advertiser”) and
          <strong> {contract.publisher || 'the Publisher'} </strong>
          (the “Publisher”). The parties agree that the Standard Terms, the applicable Insertion Order
          (“IO”) and its appendices together form the complete Agreement.
        </p>
      </section>

      <section>
        <h3>1. Scope of Services</h3>
        <p>
          The Publisher will create and publish promotional content for <strong>{contract.brand}</strong> under
          the project <strong>{contract.project}</strong>. Content will be delivered through
          <strong> {contract.platform || 'the agreed social platform'} </strong>
          using the channel <strong>{channelName}</strong>, in accordance with
          brand guidelines, the approved creative direction and the campaign schedule.
        </p>
      </section>

      <section>
        <h3>2. Deliverables and Acceptance</h3>
        {contract.deliverables.length > 0 ? (
          <ol>
            {contract.deliverables.map((deliverable) => (
              <li key={deliverable.id}>
                <strong>{deliverable.title}.</strong> {deliverable.description}
              </li>
            ))}
          </ol>
        ) : (
          <ol>
            <li><strong>Content production.</strong> Produce the agreed creator content and submit it for review before publication.</li>
            <li><strong>Publication evidence.</strong> Provide live links, screenshots and performance evidence after publication.</li>
            <li><strong>Acceptance.</strong> Correct material deviations from the approved brief within a reasonable review period.</li>
          </ol>
        )}
      </section>

      <section>
        <h3>3. Fees, Invoice and Payment</h3>
        <p>
          The total approved service fee is <strong>{formatContractMoney(contract)}</strong>.
          The Publisher shall submit a valid Invoice
          {contract.invoiceWithinWorkingDays
            ? ` within ${contract.invoiceWithinWorkingDays} working days after final acceptance`
            : ' after final acceptance'}.
          Payment will be made by <strong>{paymentMethodLabel(contract)}</strong>
          {contract.paymentWithinWorkingDays
            ? ` within ${contract.paymentWithinWorkingDays} working days after receipt of a valid Invoice`
            : ' according to the payment schedule in the IO'}.
          Transfer fees are borne by <strong>{feeBearerLabel(contract)}</strong>.
        </p>
      </section>

      <section>
        <h3>4. Content Rights, Compliance and Confidentiality</h3>
        <p>
          The Publisher warrants that all submitted content is original or properly licensed, complies with
          applicable advertising disclosure rules and does not infringe third-party rights. Usage and licensing
          rights are limited to the scope and period stated in the IO. Both parties must keep non-public campaign,
          commercial and payment information confidential.
        </p>
      </section>

      <section>
        <h3>5. Cancellation, Breach and Records</h3>
        <p>
          A material breach must be remedied within the period specified by written notice. The Advertiser may
          withhold disputed amounts for undelivered or unaccepted services. Each party will retain the Agreement,
          publication evidence, acceptance records and payment documents necessary for audit and reconciliation.
        </p>
      </section>

      <section className="contract-paper-io">
        <h3>Insertion Order</h3>
        <table>
          <tbody>
            <tr><th>Project / Brand</th><td>{contract.project} / {contract.brand}</td></tr>
            <tr><th>Publisher</th><td>{contract.publisher || 'To be confirmed'}</td></tr>
            <tr><th>Platform / Channel</th><td>{contract.platform || '—'} / {channelName}</td></tr>
            <tr><th>Campaign Period</th><td>{campaignPeriod}</td></tr>
            <tr><th>Project Total Fees</th><td>{formatContractMoney(contract)}</td></tr>
            <tr><th>Linked Payment Account</th><td>{contract.accountName || 'To be confirmed'} {contract.accountFingerprint}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="contract-paper-signatures">
        <div>
          <strong>For the Advertiser</strong>
          <span />
          <small>Name / Signature / Date</small>
        </div>
        <div>
          <strong>For the Publisher</strong>
          <span />
          <small>Name / Signature / Date</small>
        </div>
      </section>
    </article>
  );
}
