import { pdf, Document as PdfDocument, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import notoSansScRegular from '@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff?url';
import notoSansScBold from '@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-700-normal.woff?url';
import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { ContractGenerationModel } from './contracts';
export { contractGenerationFilename } from './contractGenerationFilename';

Font.register({
  family: 'NotoSansSC',
  fonts: [
    { src: notoSansScRegular, fontWeight: 400 },
    { src: notoSansScBold, fontWeight: 700 },
  ],
});

const EMPTY_LINE = '____________________________';

export const contractFieldDisplayValue = (value: string) => value.trim() || EMPTY_LINE;

export type ContractGenerationSection = {
  title: string;
  rows: Array<{ label: string; value: string }>;
  paragraphs?: string[];
};

export const contractGenerationSections = (
  model: ContractGenerationModel,
): ContractGenerationSection[] => {
  const campaignPeriod = model.campaignStart || model.campaignEnd
    ? `${contractFieldDisplayValue(model.campaignStart)} to ${contractFieldDisplayValue(model.campaignEnd)}`
    : '';
  const totalFee = [model.currency.trim(), model.totalFee.trim()].filter(Boolean).join(' ');
  return [
    {
      title: 'Standard Terms And Conditions For Digital Marketing Services',
      rows: [
        { label: 'Contract Number', value: model.contractNumber },
        { label: 'Advertiser', value: model.advertiser },
        { label: 'Publisher', value: model.publisher },
        { label: 'Effective Date', value: model.effectiveDate },
      ],
      paragraphs: [
        'The Advertiser engages the Publisher to provide the digital marketing services described in the Insertion Order. The Publisher shall perform the services in accordance with the agreed campaign requirements and applicable law.',
        'Any field left blank in this generated draft must be completed and agreed by both parties before signature. Blank fields are not deemed accepted commercial terms.',
      ],
    },
    {
      title: 'Insertion Order',
      rows: [
        { label: 'IO Number', value: model.ioNumber },
        { label: 'Project Name', value: model.projectName },
        { label: 'Brand Name', value: model.brandName },
        { label: 'Campaign Period', value: campaignPeriod },
        { label: 'Publishing Platform', value: model.platform },
        { label: 'Channel Name', value: model.channelName },
        { label: 'Channel Link', value: model.channelUrl },
      ],
    },
    {
      title: 'Services / Deliverables',
      rows: [
        { label: 'Deliverables', value: model.deliverables },
        { label: 'Additional Terms', value: model.additionalTerms },
      ],
      paragraphs: [
        'Content, release evidence, analytics screenshots and revisions must follow the final written requirements confirmed by both parties.',
      ],
    },
    {
      title: 'Payment Terms',
      rows: [
        { label: 'Project Total Fees', value: totalFee },
        { label: 'Invoice Issue Period', value: model.invoiceIssuePeriod },
        { label: 'Payment Term', value: model.paymentTerm },
        { label: 'Payment Method', value: model.paymentMethod },
        { label: 'Transfer Fee Bearer', value: model.feeBearer },
      ],
      paragraphs: [
        'Payment is subject to receipt of a valid Invoice and completion of the agreed deliverables. Bank or PayPal details must be verified separately before payment.',
      ],
    },
    {
      title: 'Signatures',
      rows: [
        { label: 'Advertiser Signature', value: '' },
        { label: 'Advertiser Signature Date', value: '' },
        { label: 'Publisher Signature', value: '' },
        { label: 'Publisher Signature Date', value: '' },
      ],
    },
  ];
};

const docxCell = (text: string, width: number, bold = false) => new TableCell({
  width: { size: width, type: WidthType.DXA },
  margins: { top: 100, bottom: 100, left: 120, right: 120 },
  children: [
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new TextRun({
        text,
        bold,
        size: 20,
        font: { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Microsoft YaHei' },
      })],
    }),
  ],
});

export const generateContractDocx = async (model: ContractGenerationModel) => {
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'D6D9DE' };
  const sections = contractGenerationSections(model);
  const document = new DocxDocument({
    creator: 'COMETS Pay',
    title: model.contractNumber || 'Generated Contract Draft',
    description: 'COMETS Pay local contract generation draft',
    sections: [{
      properties: {
        page: {
          margin: { top: 900, right: 900, bottom: 900, left: 900 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.TITLE,
          spacing: { after: 120 },
          children: [new TextRun({ text: 'DIGITAL MARKETING SERVICES AGREEMENT', bold: true, size: 32, font: 'Arial' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 360 },
          children: [new TextRun({ text: 'Generated contract draft', color: '666666', size: 18, font: 'Arial' })],
        }),
        ...sections.flatMap((section) => [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 260, after: 120 },
            children: [new TextRun({ text: section.title, bold: true, size: 25, font: 'Arial' })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [2800, 6200],
            borders: {
              top: border,
              bottom: border,
              left: border,
              right: border,
              insideHorizontal: border,
              insideVertical: border,
            },
            rows: section.rows.map((row) => new TableRow({
              children: [
                docxCell(row.label, 2800, true),
                docxCell(contractFieldDisplayValue(row.value), 6200),
              ],
            })),
          }),
          ...(section.paragraphs ?? []).map((paragraph) => new Paragraph({
            spacing: { before: 140, after: 80, line: 300 },
            children: [new TextRun({ text: paragraph, size: 19, font: 'Arial' })],
          })),
        ]),
      ],
    }],
  });
  return Packer.toBlob(document);
};

const pdfStyles = StyleSheet.create({
  page: {
    paddingVertical: 46,
    paddingHorizontal: 52,
    fontFamily: 'NotoSansSC',
    fontSize: 9,
    lineHeight: 1.45,
    color: '#17191c',
  },
  title: { fontSize: 19, fontWeight: 700, textAlign: 'center', marginBottom: 5 },
  subtitle: { textAlign: 'center', color: '#68707a', marginBottom: 22 },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    paddingBottom: 5,
    marginBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#25282d',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#d8dce2',
    minHeight: 25,
  },
  label: { width: '32%', padding: 6, fontWeight: 700, backgroundColor: '#f4f5f7' },
  value: { width: '68%', padding: 6 },
  paragraph: { marginTop: 7, color: '#3f454d' },
  footer: { position: 'absolute', left: 52, right: 52, bottom: 24, textAlign: 'center', color: '#8a9098', fontSize: 7.5 },
});

function ContractPdf({ model }: { model: ContractGenerationModel }) {
  const sections = contractGenerationSections(model);
  return (
    <PdfDocument title={model.contractNumber || 'Generated Contract Draft'} author="COMETS Pay">
      <Page size="A4" style={pdfStyles.page} wrap>
        <Text style={pdfStyles.title}>DIGITAL MARKETING SERVICES AGREEMENT</Text>
        <Text style={pdfStyles.subtitle}>Generated contract draft</Text>
        {sections.map((section) => (
          <View style={pdfStyles.section} key={section.title} wrap={false}>
            <Text style={pdfStyles.sectionTitle}>{section.title}</Text>
            {section.rows.map((row) => (
              <View style={pdfStyles.row} key={row.label}>
                <Text style={pdfStyles.label}>{row.label}</Text>
                <Text style={pdfStyles.value}>{contractFieldDisplayValue(row.value)}</Text>
              </View>
            ))}
            {(section.paragraphs ?? []).map((paragraph) => (
              <Text style={pdfStyles.paragraph} key={paragraph}>{paragraph}</Text>
            ))}
          </View>
        ))}
        <Text
          fixed
          render={({ pageNumber, totalPages }) => `COMETS Pay local draft · Page ${pageNumber} / ${totalPages}`}
          style={pdfStyles.footer}
        />
      </Page>
    </PdfDocument>
  );
}

export const generateContractPdf = async (model: ContractGenerationModel) => (
  pdf(<ContractPdf model={model} />).toBlob()
);

export const generateContractFiles = async (model: ContractGenerationModel) => {
  const [docxBlob, pdfBlob] = await Promise.all([
    generateContractDocx(model),
    generateContractPdf(model),
  ]);
  return { docxBlob, pdfBlob };
};
