import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer';
import notoSansScRegular from '@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff?url';
import notoSansScBold from '@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-700-normal.woff?url';
import type { PaymentBatchItemSnapshot } from './paymentBatches';
import { paymentProviderDisplayName } from './paymentProviderPresentation';

Font.register({
  family: 'NotoSansSC',
  fonts: [
    { src: notoSansScRegular, fontWeight: 400 },
    { src: notoSansScBold, fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    color: '#24272f',
    fontFamily: 'NotoSansSC',
    fontSize: 10,
    lineHeight: 1.55,
    padding: 52,
  },
  eyebrow: { color: '#7b818e', fontSize: 9, letterSpacing: 1.2, marginBottom: 10 },
  title: { color: '#202229', fontSize: 24, fontWeight: 700, marginBottom: 5 },
  prototype: { color: '#a04a3e', fontSize: 9, marginBottom: 26 },
  hero: {
    backgroundColor: '#f4f0f8',
    borderColor: '#dfd5e7',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 22,
    padding: 18,
  },
  heroLabel: { color: '#767c87', fontSize: 9, marginBottom: 5 },
  heroValue: { color: '#202229', fontSize: 21, fontWeight: 700 },
  grid: { borderColor: '#e2e5ea', borderTopWidth: 1 },
  row: {
    borderBottomColor: '#e2e5ea',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 42,
    paddingBottom: 10,
    paddingTop: 10,
  },
  label: { color: '#747b87', width: 142 },
  value: { color: '#252830', flexGrow: 1, fontWeight: 700 },
  footnote: { color: '#8a909b', fontSize: 8.5, marginTop: 24 },
});

const confirmationDateLabel = (value?: string) => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '未记录';
};

function GenericPaymentConfirmationDocument({ item }: { item: PaymentBatchItemSnapshot }) {
  const actualPaid = item.actualPaidAmount !== undefined && item.actualPaidCurrency
    ? `${item.actualPaidCurrency} ${item.actualPaidAmount.toLocaleString('en-US')}`
    : `${item.currency} ${item.amount.toLocaleString('en-US')}`;
  const rows = [
    ['付款渠道', paymentProviderDisplayName(item.provider)],
    ['付款编号', item.paymentCode || '付款编号待补全'],
    ['收款方账户名', item.accountName || '待补充'],
    ['实际付款日期', confirmationDateLabel(item.paymentSubmittedAt)],
    ['付款方式', item.localClearingSystem || item.transferMethod],
    ['收款国家 / 地区', item.recipientCountry || '待补充'],
    ['付款状态', item.paymentStatus],
  ];
  return (
    <Document title={`${item.accountName || item.creatorName} 付款确认函`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>COMETS PAY · PAYMENT CONFIRMATION</Text>
        <Text style={styles.title}>付款确认函</Text>
        <Text style={styles.prototype}>前端原型确认函 · 不代表支付渠道正式凭证</Text>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>付款方支付金额</Text>
          <Text style={styles.heroValue}>{actualPaid}</Text>
        </View>
        <View style={styles.grid}>
          {rows.map(([label, value]) => (
            <View style={styles.row} key={label}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footnote}>本文件由 COMETS Pay 前端原型生成，仅用于产品流程演示。</Text>
      </Page>
    </Document>
  );
}

export const createGenericPaymentConfirmationPdf = async (item: PaymentBatchItemSnapshot) => (
  pdf(<GenericPaymentConfirmationDocument item={item} />).toBlob()
);
