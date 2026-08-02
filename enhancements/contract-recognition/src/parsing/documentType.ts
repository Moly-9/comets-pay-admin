import type { DocumentType, ParsedBlock } from "../types";

export const detectDocumentType = (
  fileName: string,
  blocks: ParsedBlock[],
): DocumentType => {
  if (/payment[\s_-]+(?:addendum|supplement|amendment)|付款补充协议|支付补充协议/i.test(fileName)) {
    return "PAYMENT_ADDENDUM";
  }
  if (/standard[\s_-]+terms|标准条款|通用条款/i.test(fileName)) {
    return "STANDARD_TERMS";
  }
  if (/main[\s_-]+agreement|master[\s_-]+(?:services?[\s_-]+)?agreement|主协议|框架协议/i.test(fileName)) {
    return "MAIN_AGREEMENT";
  }
  if (/(?:^|[\s_-])IO(?:[\s_.-]|$)|insertion[\s_-]+order|投放订单/i.test(fileName)) {
    return "IO";
  }
  if (/signature[\s_-]+page|签署页|签字页/i.test(fileName)) {
    return "SIGNATURE_PAGE";
  }
  const sample = `${fileName}\n${blocks
    .slice(0, 24)
    .map((block) => block.text)
    .join("\n")}`;

  if (
    /payment\s+(?:addendum|supplement|amendment)|付款补充协议|支付补充协议/i.test(
      sample,
    )
  ) {
    return "PAYMENT_ADDENDUM";
  }
  if (/(?:^|[\s_-])IO(?:[\s_.-]|$)|insertion\s+order|投放订单|IO\s*(?:No|Number|编号)/i.test(sample)) {
    return "IO";
  }
  if (/standard[\s_-]+terms|标准条款|通用条款/i.test(sample)) {
    return "STANDARD_TERMS";
  }
  if (/main[\s_-]+agreement|master[\s_-]+(?:services?[\s_-]+)?agreement|主协议|框架协议/i.test(sample)) {
    return "MAIN_AGREEMENT";
  }
  if (/signature\s+page|签署页|签字页/i.test(sample)) {
    return "SIGNATURE_PAGE";
  }
  return "UNKNOWN";
};
