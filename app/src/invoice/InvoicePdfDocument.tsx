import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import notoSansScRegular from '@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff?url';
import notoSansScBold from '@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-700-normal.woff?url';
import type { InvoiceDocumentModel, InvoiceLineItem } from '../types';
import { bankAddress, formatInvoiceDate, formatInvoiceMoney, invoiceTotal } from './invoiceUtils';

Font.register({
  family: 'NotoSansSC',
  fonts: [
    { src: notoSansScRegular, fontWeight: 400 },
    { src: notoSansScBold, fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    width: 612,
    height: 792,
    minHeight: 792,
    maxHeight: 792,
    backgroundColor: '#ffffff',
    color: '#111111',
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    lineHeight: 1.35,
    paddingTop: 54,
    paddingRight: 58,
    paddingBottom: 50,
    paddingLeft: 58,
  },
  cjk: { fontFamily: 'NotoSansSC' },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 27, textAlign: 'center', letterSpacing: 1.5, marginBottom: 24 },
  invoiceNumber: { fontFamily: 'Helvetica-Bold', fontSize: 10, textAlign: 'right', marginBottom: 14 },
  billToLabel: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 4 },
  billToName: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginBottom: 3 },
  billToAddress: { color: '#333333', maxWidth: 430, marginBottom: 21 },
  infoGrid: { flexDirection: 'row', borderTopWidth: 0.8, borderTopColor: '#202020', paddingTop: 11, marginBottom: 19 },
  infoColumn: { width: '58%' },
  invoiceColumn: { width: '42%', paddingLeft: 22 },
  sectionLabel: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginBottom: 6 },
  infoLine: { flexDirection: 'row', marginBottom: 3 },
  infoLineLabel: { fontFamily: 'Helvetica-Bold', width: 88 },
  infoLineValue: { flexGrow: 1, maxWidth: 250 },
  table: { borderWidth: 0.8, borderColor: '#111111', marginBottom: 8 },
  tableRow: { flexDirection: 'row', minHeight: 27, borderBottomWidth: 0.6, borderBottomColor: '#777777' },
  tableRowLast: { borderBottomWidth: 0 },
  tableHeader: { backgroundColor: '#111111', minHeight: 28 },
  headerText: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
  descriptionCell: { width: '47%', paddingVertical: 7, paddingHorizontal: 8, justifyContent: 'center' },
  priceCell: { width: '19%', paddingVertical: 7, paddingHorizontal: 7, justifyContent: 'center', alignItems: 'flex-end', borderLeftWidth: 0.6, borderLeftColor: '#777777' },
  quantityCell: { width: '14%', paddingVertical: 7, paddingHorizontal: 7, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 0.6, borderLeftColor: '#777777' },
  totalCell: { width: '20%', paddingVertical: 7, paddingHorizontal: 7, justifyContent: 'center', alignItems: 'flex-end', borderLeftWidth: 0.6, borderLeftColor: '#777777' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 22 },
  totalLabel: { fontFamily: 'Helvetica-Bold', marginRight: 20 },
  totalValue: { fontFamily: 'Helvetica-Bold', fontSize: 11, minWidth: 118, textAlign: 'right' },
  paymentSection: { borderTopWidth: 0.8, borderTopColor: '#202020', paddingTop: 12, marginTop: 2 },
  paymentTitle: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 8 },
  paymentChoice: { fontFamily: 'Helvetica-Bold', marginBottom: 7 },
  paymentLine: { flexDirection: 'row', marginBottom: 4 },
  paymentLabel: { fontFamily: 'Helvetica-Bold', width: 145 },
  paymentValue: { flexGrow: 1 },
  signature: { marginTop: 22 },
  signatureLabel: { fontFamily: 'Helvetica-Bold', marginBottom: 28 },
  signatureLine: { width: 210, borderBottomWidth: 0.7, borderBottomColor: '#111111' },
  continuation: { fontSize: 8.5, color: '#666666', textAlign: 'right', marginBottom: 8 },
});

const hasCjk = (value: string) => /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(value);

const itemChunks = (items: InvoiceLineItem[], size = 7) => {
  const chunks: InvoiceLineItem[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks.length > 0 ? chunks : [[]];
};

function TableHeader() {
  return (
    <View style={[styles.tableRow, styles.tableHeader]}>
      <View style={styles.descriptionCell}><Text style={styles.headerText}>DESCRIPTION</Text></View>
      <View style={styles.priceCell}><Text style={styles.headerText}>PRICE</Text></View>
      <View style={styles.quantityCell}><Text style={styles.headerText}>AMOUNT</Text></View>
      <View style={styles.totalCell}><Text style={styles.headerText}>TOTAL</Text></View>
    </View>
  );
}

function PaymentInformation({ model }: { model: InvoiceDocumentModel }) {
  const bankLines = [
    ['Real Name', model.from.legalName],
    ['Account Name', model.payment.accountName],
    ['Account Number', model.payment.accountNumber],
    ['Beneficiary Bank Name', model.payment.bankName],
    ['Beneficiary Bank Address', bankAddress(model)],
    ['Swift Code', model.payment.swiftCode],
    ['IBAN (optional)', model.payment.iban || '-'],
  ];
  const paypalLines = [
    ['Paypal Name', model.payment.paypalUsername],
    ['Paypal Email', model.payment.paypalEmail],
  ];
  const lines = model.paymentMethod === 'bank' ? bankLines : paypalLines;
  return (
    <View style={styles.paymentSection}>
      <Text style={styles.paymentTitle}>Payment information (choose one)</Text>
      <Text style={styles.paymentChoice}>{model.paymentMethod === 'bank' ? 'Paid by Bank' : 'Paid by Paypal'}</Text>
      {lines.map(([label, value]) => (
        <View style={styles.paymentLine} key={label}>
          <Text style={styles.paymentLabel}>{label}:</Text>
          <Text style={[styles.paymentValue, hasCjk(value) ? styles.cjk : {}]}>{value}</Text>
        </View>
      ))}
      <View style={styles.signature}>
        <Text style={styles.signatureLabel}>Signature:</Text>
        <View style={styles.signatureLine} />
      </View>
    </View>
  );
}

export function InvoicePdfDocument({ model }: { model: InvoiceDocumentModel }) {
  const chunks = itemChunks(model.items);
  const total = invoiceTotal(model);
  return (
    <Document title={model.invoiceNumber} author="COMETS Pay" subject={`Invoice for ${model.projectName}`}>
      {chunks.map((items, pageIndex) => {
        const lastPage = pageIndex === chunks.length - 1;
        return (
          <Page key={`${model.invoiceNumber}-${pageIndex}`} size="LETTER" style={styles.page} wrap={false}>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>Invoice No. {model.invoiceNumber}</Text>
            <Text style={styles.billToLabel}>Bill to</Text>
            <Text style={[styles.billToName, hasCjk(model.billTo.name) ? styles.cjk : {}]}>{model.billTo.name}</Text>
            <Text style={[styles.billToAddress, hasCjk(model.billTo.address) ? styles.cjk : {}]}>{model.billTo.address}</Text>

            <View style={styles.infoGrid}>
              <View style={styles.infoColumn}>
                <Text style={styles.sectionLabel}>From</Text>
                {[
                  ['Real Name', model.from.legalName],
                  ['Address', model.from.address],
                  ['Tel', model.from.phone],
                  ['Email', model.from.email],
                ].map(([label, value]) => (
                  <View style={styles.infoLine} key={label}>
                    <Text style={styles.infoLineLabel}>{label}:</Text>
                    <Text style={[styles.infoLineValue, hasCjk(value) ? styles.cjk : {}]}>{value}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.invoiceColumn}>
                <Text style={styles.sectionLabel}>Invoice</Text>
                <View style={styles.infoLine}><Text style={styles.infoLineLabel}>Date of Invoice:</Text><Text>{formatInvoiceDate(model.invoiceDate)}</Text></View>
                <View style={styles.infoLine}><Text style={styles.infoLineLabel}>Currency:</Text><Text>[{model.currency}]</Text></View>
                <View style={styles.infoLine}><Text style={styles.infoLineLabel}>Project:</Text><Text style={hasCjk(model.projectName) ? styles.cjk : {}}>{model.projectName}</Text></View>
              </View>
            </View>

            {chunks.length > 1 ? <Text style={styles.continuation}>Page {pageIndex + 1} of {chunks.length}</Text> : null}
            <View style={styles.table}>
              <TableHeader />
              {items.map((item, index) => (
                <View style={[styles.tableRow, index === items.length - 1 ? styles.tableRowLast : {}]} key={item.id}>
                  <View style={styles.descriptionCell}><Text style={hasCjk(item.description) ? styles.cjk : {}}>{item.description}</Text></View>
                  <View style={styles.priceCell}><Text>{formatInvoiceMoney(model.currency, item.unitPrice)}</Text></View>
                  <View style={styles.quantityCell}><Text>{item.quantity.toLocaleString('en-US')}</Text></View>
                  <View style={styles.totalCell}><Text>{formatInvoiceMoney(model.currency, item.lineTotal)}</Text></View>
                </View>
              ))}
            </View>

            {lastPage ? (
              <>
                <View style={styles.totalRow}><Text style={styles.totalLabel}>TOTAL PRICE</Text><Text style={styles.totalValue}>{formatInvoiceMoney(model.currency, total)}</Text></View>
                <PaymentInformation model={model} />
              </>
            ) : null}
          </Page>
        );
      })}
    </Document>
  );
}
