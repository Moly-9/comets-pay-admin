import { aliases, fieldDefinitions, labelsByKey } from "./fieldDefinitions";
import {
  normalizeDate,
  normalizeDateRange,
  normalizeDays,
  normalizeMoney,
  normalizePaymentMethod,
  normalizeTransferFee,
  normalizedIdentity,
} from "./normalizers";
import type {
  DocumentType,
  FieldKey,
  ParsedBlock,
  ParsedDocument,
  RecognitionCandidate,
  RecognitionContext,
  RecognitionField,
  RecognitionResult,
  SourceLocation,
} from "../types";

type CandidateMap = Record<FieldKey, RecognitionCandidate[]>;

const emptyCandidateMap = (): CandidateMap =>
  Object.fromEntries(
    fieldDefinitions.map((definition) => [definition.key, []]),
  ) as unknown as CandidateMap;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const cleanupValue = (value: string) =>
  value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/^[\s:：\-–—]+/, "")
    .replace(/\s+/g, " ")
    .replace(/[\s,，;；]+$/, "")
    .trim();

const blockSource = (
  document: ParsedDocument,
  block: ParsedBlock,
  sourceText: string,
): SourceLocation => ({
  documentType: document.documentType,
  fileName: document.fileName,
  pageNumber: block.pageNumber,
  paragraphIndex: block.paragraphIndex,
  section: block.section,
  sourceText,
  coordinates: block.coordinates,
});

const includesAlias = (text: string, values: readonly string[]) =>
  values.some((alias) => text.toLocaleLowerCase().includes(alias.toLocaleLowerCase()));

const extractValue = (text: string, values: readonly string[]): string | null => {
  const pattern = values
    .slice()
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  const explicitMatch = text.match(
    new RegExp(
      `(?:^|[\\s|｜;；])(?:${pattern})\\s*(?::|：|\\-|–|—|\\||｜|\\n)\\s*([^\\n|｜;；]{1,240})`,
      "i",
    ),
  );
  if (explicitMatch) return cleanupValue(explicitMatch[1]);

  return null;
};

const candidateTexts = (
  document: ParsedDocument,
  aliasesForField: readonly string[],
): Array<{ text: string; block: ParsedBlock }> => {
  const entries: Array<{ text: string; block: ParsedBlock }> = [];
  const labelPattern = aliasesForField
    .slice()
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  document.blocks.forEach((block, index) => {
    entries.push({ text: block.text, block });
    const next = document.blocks[index + 1];
    if (
      next &&
      block.kind !== "heading" &&
      new RegExp(
        `^\\s*(?:${labelPattern})\\s*(?::|：|\\-|–|—|\\||｜)?\\s*$`,
        "i",
      ).test(block.text) &&
      (next.pageNumber === block.pageNumber ||
        (block.pageNumber && next.pageNumber === block.pageNumber + 1))
    ) {
      entries.push({
        text: `${block.text}\n${next.text}`,
        block,
      });
    }
  });
  return entries;
};

const isPlaceholderValue = (value: string) =>
  !value ||
  /please\s+fill|fill\s+in|to\s+be\s+(?:filled|confirmed)|待填写|待补充|待确认|\bTBD\b|\bN\/?A\b|_{3,}|x{4,}|^\[[^\]]*(?:name|fill|insert|xxx)[^\]]*\]$/i.test(
    value,
  ) ||
  /(?:Name|Number|Date|Link|URL)\s*[:：]\s*$/i.test(value);

const collectLabeled = <T>(
  document: ParsedDocument,
  values: readonly string[],
  normalize: (rawValue: string) => T | null,
  confidence = 0.94,
): RecognitionCandidate<T>[] => {
  const candidates: RecognitionCandidate<T>[] = [];
  for (const { text, block } of candidateTexts(document, values)) {
    if (!includesAlias(text, values)) continue;
    const rawValue = extractValue(text, values);
    if (!rawValue || isPlaceholderValue(rawValue)) continue;
    const normalizedValue = normalize(rawValue);
    if (normalizedValue === null) continue;
    candidates.push({
      rawValue,
      normalizedValue,
      source: blockSource(document, block, text),
      confidence,
      qualifier: "explicit",
    });
  }
  return dedupeCandidates(candidates);
};

const asText = (value: string) => value || null;

const findFirstForFile = <T>(
  candidates: RecognitionCandidate<T>[],
  fileName: string,
) => candidates.find((candidate) => candidate.source.fileName === fileName);

const collectProjectBrand = (
  document: ParsedDocument,
): RecognitionCandidate[] => {
  const projects = collectLabeled(document, aliases.projectName, asText, 0.92);
  const brands = collectLabeled(document, aliases.brandName, asText, 0.9);
  const candidates: RecognitionCandidate[] = [];

  for (const project of projects) {
    const brand = findFirstForFile(brands, project.source.fileName);
    const normalizedValue = {
      projectName: project.normalizedValue,
      brandName: brand?.normalizedValue ?? "",
    };
    candidates.push({
      rawValue: brand
        ? `${project.rawValue} / ${brand.rawValue}`
        : project.rawValue,
      normalizedValue,
      source: project.source,
      confidence: brand ? 0.94 : project.confidence,
      qualifier: "explicit",
    });
  }

  if (!projects.length) {
    for (const brand of brands) {
      candidates.push({
        ...brand,
        normalizedValue: { projectName: "", brandName: brand.normalizedValue },
      });
    }
  }
  return dedupeCandidates(candidates);
};

const knownPlatforms = [
  "YouTube",
  "TikTok",
  "Instagram",
  "Twitch",
  "Facebook",
  "X",
  "Bilibili",
  "小红书",
  "抖音",
];

const collectPlatformChannel = (
  document: ParsedDocument,
): RecognitionCandidate[] => {
  const platforms = collectLabeled(document, aliases.platform, asText, 0.93);
  const channels = collectLabeled(
    document,
    aliases.channelName,
    asText,
    0.91,
  ).filter(
    (candidate) =>
      !/^(?:Link|URL|Handle)(?:\b|[_\W])/i.test(candidate.rawValue) &&
      !isPlaceholderValue(candidate.rawValue),
  );
  const handles = collectLabeled(document, aliases.handle, asText, 0.9);
  const urls = collectLabeled(
    document,
    aliases.channelUrl,
    asText,
    0.96,
  ).filter((candidate) => !isPlaceholderValue(candidate.rawValue));
  const candidates: RecognitionCandidate[] = [];
  const anchor = platforms[0] ?? channels[0] ?? urls[0] ?? handles[0];
  if (!anchor) return candidates;

  const rawPlatform = platforms[0]?.rawValue ?? "";
  const platform =
    knownPlatforms.find((item) =>
      rawPlatform.toLocaleLowerCase().includes(item.toLocaleLowerCase()),
    ) ?? rawPlatform.split(/[·|｜,，]/)[0].trim();
  const inlineParts = rawPlatform.split(/[·|｜]/).map((item) => item.trim());
  const channelName = channels[0]?.rawValue ?? inlineParts[1] ?? "";
  const handleMatch = `${handles[0]?.rawValue ?? ""} ${rawPlatform}`.match(
    /@[A-Za-z0-9._-]+/,
  );
  const urlMatch = `${urls[0]?.rawValue ?? ""} ${rawPlatform}`.match(
    /https?:\/\/[^\s,，;；]+/i,
  );
  const normalizedValue = {
    platform,
    channelName,
    handle: handleMatch?.[0] ?? "",
    channelUrl: urlMatch?.[0] ?? urls[0]?.rawValue ?? "",
  };
  candidates.push({
    rawValue: [
      rawPlatform,
      channelName && !rawPlatform.includes(channelName) ? channelName : "",
      normalizedValue.channelUrl,
    ]
      .filter(Boolean)
      .join(" · "),
    normalizedValue,
    source: anchor.source,
    confidence: 0.92,
    qualifier: "explicit",
  });
  return candidates;
};

const collectCampaignPeriod = (
  document: ParsedDocument,
): RecognitionCandidate[] => {
  const ranges = collectLabeled(
    document,
    aliases.campaignPeriod,
    normalizeDateRange,
    0.96,
  );
  const starts = collectLabeled(document, aliases.startDate, normalizeDate, 0.94);
  const ends = collectLabeled(document, aliases.endDate, normalizeDate, 0.94);
  if (starts.length && ends.length) {
    const start = starts[0];
    const end = ends[0];
    ranges.push({
      rawValue: `${start.rawValue} to ${end.rawValue}`,
      normalizedValue: {
        startDate: start.normalizedValue,
        endDate: end.normalizedValue,
      },
      source: start.source,
      confidence: 0.94,
      qualifier: "explicit",
    });
  }
  return dedupeCandidates(ranges);
};

const collectInvoicePeriod = (
  document: ParsedDocument,
): RecognitionCandidate[] =>
  collectLabeled(
    document,
    aliases.invoiceIssuePeriod,
    (rawValue) => {
      const date = normalizeDate(rawValue);
      const normalizedDays = normalizeDays(rawValue);
      return {
        date,
        normalizedDays,
        description: rawValue,
      };
    },
    0.91,
  );

const collectPaymentTerm = (
  document: ParsedDocument,
): RecognitionCandidate[] =>
  collectLabeled(
    document,
    aliases.paymentTerm,
    (rawValue) => ({
      description: rawValue,
      normalizedDays: normalizeDays(rawValue),
    }),
    0.94,
  );

const collectBeneficiary = (
  document: ParsedDocument,
): RecognitionCandidate[] =>
  collectLabeled(
    document,
    aliases.beneficiaryAccount,
    (rawValue) => ({ snapshot: rawValue }),
    0.88,
  );

const dedupeCandidates = <T>(
  candidates: RecognitionCandidate<T>[],
): RecognitionCandidate<T>[] => {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = [
      normalizedIdentity(candidate.normalizedValue),
      candidate.source.fileName,
      candidate.source.pageNumber ?? "",
      candidate.source.paragraphIndex ?? "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const paymentTypes: DocumentType[] = [
  "PAYMENT_ADDENDUM",
  "IO",
  "STANDARD_TERMS",
  "MAIN_AGREEMENT",
  "SIGNATURE_PAGE",
  "UNKNOWN",
];

const priorityFor = (fieldKey: FieldKey, documentType: DocumentType | "SYSTEM") => {
  if (documentType === "SYSTEM") return -1;
  if (
    ["ioNumber", "projectBrand", "platformChannel", "campaignPeriod"].includes(
      fieldKey,
    )
  ) {
    return documentType === "IO" ? 0 : 10;
  }
  if (["advertiser", "publisher"].includes(fieldKey)) {
    const order: DocumentType[] = [
      "STANDARD_TERMS",
      "MAIN_AGREEMENT",
      "SIGNATURE_PAGE",
      "IO",
      "PAYMENT_ADDENDUM",
      "UNKNOWN",
    ];
    return order.indexOf(documentType);
  }
  if (
    [
      "projectTotalFees",
      "invoiceIssuePeriod",
      "paymentTerm",
      "paymentMethod",
      "transferFee",
      "beneficiaryAccount",
    ].includes(fieldKey)
  ) {
    return paymentTypes.indexOf(documentType);
  }
  return 5;
};

const missingField = (fieldKey: FieldKey): RecognitionField => ({
  fieldKey,
  label: labelsByKey.get(fieldKey) ?? fieldKey,
  rawValue: "",
  normalizedValue: null,
  source: null,
  confidence: 0,
  status: "missing",
  candidates: [],
});

const systemCandidate = (value: string): RecognitionCandidate<string> => ({
  rawValue: value,
  normalizedValue: value,
  source: {
    documentType: "SYSTEM",
    fileName: "系统合同资料",
    section: "系统字段",
    sourceText: value,
  },
  confidence: 1,
  qualifier: "explicit",
});

const resolveCandidates = (
  fieldKey: FieldKey,
  originalCandidates: RecognitionCandidate[],
  context: RecognitionContext,
): RecognitionField => {
  let candidates = dedupeCandidates(originalCandidates).sort(
    (left, right) =>
      priorityFor(fieldKey, left.source.documentType) -
      priorityFor(fieldKey, right.source.documentType),
  );
  if (!candidates.length) return missingField(fieldKey);

  if (fieldKey === "contractNumber" && context.systemContractNumber?.trim()) {
    const system = systemCandidate(context.systemContractNumber.trim());
    const mismatches = candidates.filter(
      (candidate) =>
        normalizedIdentity(candidate.normalizedValue) !==
        normalizedIdentity(system.normalizedValue),
    );
    return {
      fieldKey,
      label: labelsByKey.get(fieldKey) ?? fieldKey,
      rawValue: system.rawValue,
      normalizedValue: system.normalizedValue,
      source: system.source,
      confidence: 1,
      status: mismatches.length ? "conflict" : "detected",
      candidates: mismatches.length ? [system, ...candidates] : candidates,
    };
  }

  const identities = new Set(
    candidates.map((candidate) => normalizedIdentity(candidate.normalizedValue)),
  );
  const selected = candidates[0];
  let status: RecognitionField["status"] =
    identities.size > 1 ? "conflict" : "detected";

  if (
    fieldKey === "beneficiaryAccount" &&
    context.creatorAccountSnapshot?.trim()
  ) {
    const expected = normalizedIdentity(context.creatorAccountSnapshot).replace(
      /\W/g,
      "",
    );
    const actual = normalizedIdentity(selected.rawValue).replace(/\W/g, "");
    if (expected && !actual.includes(expected) && !expected.includes(actual)) {
      candidates = [
        systemCandidate(context.creatorAccountSnapshot) as RecognitionCandidate,
        ...candidates,
      ];
      status = "conflict";
    }
  }

  return {
    fieldKey,
    label: labelsByKey.get(fieldKey) ?? fieldKey,
    rawValue: status === "conflict" ? "" : selected.rawValue,
    normalizedValue: status === "conflict" ? null : selected.normalizedValue,
    source: status === "conflict" ? null : selected.source,
    confidence: status === "conflict" ? 0 : selected.confidence,
    status,
    candidates: status === "conflict" ? candidates : [],
  };
};

export const recognizeDocuments = (
  documents: ParsedDocument[],
  context: RecognitionContext = {},
): RecognitionResult => {
  const candidateMap = emptyCandidateMap();
  const signatureDateCandidates: RecognitionCandidate[] = [];

  for (const document of documents.filter((item) => item.status === "parsed")) {
    const hasProjectContext = document.blocks.some((block) =>
      includesAlias(block.text, aliases.projectName),
    );
    const advertiserAliases =
      document.documentType === "IO" || hasProjectContext
        ? aliases.advertiser.filter((alias) => alias !== "Brand")
        : aliases.advertiser;
    candidateMap.advertiser.push(
      ...collectLabeled(document, advertiserAliases, asText),
    );
    candidateMap.publisher.push(
      ...collectLabeled(document, aliases.publisher, asText),
    );
    candidateMap.contractNumber.push(
      ...collectLabeled(document, aliases.contractNumber, asText),
    );
    candidateMap.ioNumber.push(
      ...collectLabeled(document, aliases.ioNumber, asText),
    );
    candidateMap.projectBrand.push(...collectProjectBrand(document));
    candidateMap.platformChannel.push(...collectPlatformChannel(document));
    candidateMap.effectiveDate.push(
      ...collectLabeled(document, aliases.effectiveDate, normalizeDate, 0.96),
    );
    signatureDateCandidates.push(
      ...collectLabeled(document, aliases.signatureDate, normalizeDate, 0.82).map(
        (candidate) => ({ ...candidate, qualifier: "candidate" as const }),
      ),
    );
    candidateMap.campaignPeriod.push(...collectCampaignPeriod(document));
    candidateMap.projectTotalFees.push(
      ...collectLabeled(
        document,
        aliases.projectTotalFees,
        normalizeMoney,
        0.96,
      ),
    );
    candidateMap.invoiceIssuePeriod.push(...collectInvoicePeriod(document));
    candidateMap.paymentTerm.push(...collectPaymentTerm(document));
    candidateMap.paymentMethod.push(
      ...collectLabeled(
        document,
        aliases.paymentMethod,
        normalizePaymentMethod,
        0.94,
      ),
    );
    candidateMap.transferFee.push(
      ...collectLabeled(
        document,
        aliases.transferFee,
        normalizeTransferFee,
        0.9,
      ),
    );
    candidateMap.beneficiaryAccount.push(...collectBeneficiary(document));
  }

  const fields = Object.fromEntries(
    fieldDefinitions.map(({ key }) => [
      key,
      resolveCandidates(key, candidateMap[key], context),
    ]),
  ) as Record<FieldKey, RecognitionField>;

  if (
    fields.effectiveDate.status === "missing" &&
    signatureDateCandidates.length
  ) {
    fields.effectiveDate = {
      ...fields.effectiveDate,
      candidates: dedupeCandidates(signatureDateCandidates),
    };
  }

  return {
    documents,
    fields,
    recognizedAt: new Date().toISOString(),
  };
};
