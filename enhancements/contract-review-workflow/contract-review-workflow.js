(() => {
  "use strict";

  const STORAGE_PREFIX = "comets-pay.contract-review.v1";
  const PENDING_UPLOAD_KEY = "comets-pay.contract-upload.pending.v1";
  const ICON_ROOT = "/assets/contract-review-workflow";
  const PLACEHOLDER_PATTERN =
    /^(?:待识别|待补充|待解析|待关联|待选择|未识别|缺失|—|-|)$/;
  const parseTimers = new Map();
  let observerQueued = false;
  let toastTimer = 0;

  const FIELD_DEFINITIONS = {
    Advertiser: {
      key: "advertiser",
      aliases: ["Advertiser", "Client", "Company", "广告主", "客户", "甲方"],
      source: "合同正文 · 本地解析",
    },
    Publisher: {
      key: "publisher",
      aliases: [
        "Publisher",
        "Creator",
        "Influencer",
        "Service Provider",
        "发布方",
        "达人",
        "创作者",
        "乙方",
      ],
      source: "合同正文 · 本地解析",
    },
    合同编号: {
      key: "contractNumber",
      aliases: [
        "Contract Number",
        "Contract No.",
        "Agreement Number",
        "合同编号",
        "协议编号",
      ],
      source: "系统字段",
      editable: false,
    },
    IO编号: {
      key: "ioNumber",
      aliases: [
        "IO Number",
        "IO No.",
        "Insertion Order Number",
        "订单编号",
        "IO 编号",
      ],
      source: "IO · 本地解析",
    },
    "项目 / 品牌": {
      key: "projectBrand",
      aliases: ["Project Name", "Campaign Name", "项目名称", "活动名称"],
      secondaryAliases: ["Brand", "品牌"],
      source: "IO · 本地解析",
      multiline: true,
    },
    "平台 / 频道": {
      key: "platformChannel",
      aliases: ["Platform", "Publishing Platform", "平台", "发布平台"],
      secondaryAliases: ["Channel Name", "Channel", "频道", "账号"],
      source: "IO · 本地解析",
      multiline: true,
    },
    生效日期: {
      key: "effectiveDate",
      aliases: ["Effective Date", "Agreement Effective Date", "生效日期"],
      source: "合同正文 · 本地解析",
    },
    "Campaign Period": {
      key: "campaignPeriod",
      aliases: [
        "Campaign Period",
        "Campaign Date",
        "Service Period",
        "活动周期",
        "项目周期",
      ],
      source: "IO · 本地解析",
      multiline: true,
    },
    "Project Total Fees": {
      key: "totalFees",
      aliases: [
        "Project Total Fees",
        "Total Fees",
        "Contract Amount",
        "Service Fee",
        "项目总费用",
      ],
      source: "付款条款 · 本地解析",
    },
    Invoice开具期限: {
      key: "invoiceIssuePeriod",
      aliases: [
        "Invoice Issue Period",
        "Invoice Submission Period",
        "Invoice开具期限",
        "发票开具期限",
      ],
      source: "付款条款 · 本地解析",
      multiline: true,
    },
    付款期限: {
      key: "paymentTerm",
      aliases: ["Payment Term", "Payment Terms", "付款期限", "付款条款"],
      source: "付款条款 · 本地解析",
      multiline: true,
    },
    付款方式: {
      key: "paymentMethod",
      aliases: ["Payment Method", "付款方式"],
      source: "付款条款 · 本地解析",
    },
    转账费用: {
      key: "transferFee",
      aliases: ["Transfer Fee", "Bank Fee", "转账费用", "手续费"],
      source: "付款条款 · 本地解析",
      multiline: true,
    },
    合同账户快照: {
      key: "accountSnapshot",
      aliases: [
        "Beneficiary",
        "Bank Account",
        "Account Holder",
        "收款主体",
        "银行账户",
      ],
      source: "付款条款 · 本地解析",
      multiline: true,
    },
  };

  const EDITABLE_FIELDS = Object.values(FIELD_DEFINITIONS)
    .filter((field) => field.editable !== false)
    .map((field) => field.key);

  const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

  const isPlaceholder = (value) => {
    const normalized = normalizeText(value);
    if (PLACEHOLDER_PATTERN.test(normalized)) return true;
    return normalized
      .split("·")
      .map((part) => part.trim())
      .some((part) => PLACEHOLDER_PATTERN.test(part));
  };

  const storageKey = (contractId) => `${STORAGE_PREFIX}:${contractId}`;

  const saveState = (state) => {
    try {
      localStorage.setItem(storageKey(state.contractId), JSON.stringify(state));
    } catch {
      // The workflow remains usable for the current page session.
    }
  };

  const loadState = (contractId) => {
    try {
      const raw = localStorage.getItem(storageKey(contractId));
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (saved?.version !== 1 || saved.contractId !== contractId) return null;
      return saved;
    } catch {
      return null;
    }
  };

  const contractContext = () => {
    const page = document.querySelector(".contract-detail-page");
    const subtitle = page?.querySelector(":scope > .page-heading-row p");
    const contractId = subtitle?.textContent?.match(/CON-[A-Z0-9-]+/)?.[0];
    if (!page || !contractId || !contractId.startsWith("CON-UPL-")) return null;
    return {
      page,
      contractId,
      fileName: page.querySelector(":scope > .page-heading-row h1")?.textContent?.trim() || "",
      subtitle,
    };
  };

  const takePendingUpload = (fileName) => {
    try {
      const raw = sessionStorage.getItem(PENDING_UPLOAD_KEY);
      if (!raw) return null;
      const pending = JSON.parse(raw);
      const fileIdentity = (value) =>
        normalizeText(value)
          .toLocaleLowerCase()
          .replace(/\.(?:pdf|docx?|html)$/i, "");
      if (
        pending?.version !== 1 ||
        fileIdentity(pending.fileName) !== fileIdentity(fileName)
      ) {
        return null;
      }
      sessionStorage.removeItem(PENDING_UPLOAD_KEY);
      return pending;
    } catch {
      return null;
    }
  };

  const createState = ({ contractId, fileName }) => {
    const uploadContext = takePendingUpload(fileName);
    return {
      version: 1,
      contractId,
      fileName,
      phase: "parsing",
      fields: {
        contractNumber: {
          value: contractId,
          source: "系统字段",
          status: "detected",
        },
      },
      uploadContext,
      revision: 0,
      parsedAt: null,
      confirmedAt: null,
    };
  };

  const readVisibleFieldDefaults = () => {
    const defaults = {};
    document
      .querySelectorAll(
        ".contract-definition-list > div, .contract-payment-list > div"
      )
      .forEach((row) => {
        const label = row.querySelector("dt")?.textContent?.trim();
        const definition = FIELD_DEFINITIONS[label];
        const dd = row.querySelector("dd");
        if (!definition || !dd) return;
        const clone = dd.cloneNode(true);
        clone.querySelectorAll("small, button, input, textarea").forEach((node) =>
          node.remove()
        );
        const value = normalizeText(clone.textContent);
        const source = dd.querySelector("small")?.textContent?.trim();
        defaults[definition.key] = {
          value,
          source: source || definition.source,
        };
      });
    return defaults;
  };

  const readDocumentText = () => {
    const frame = document.querySelector(
      ".contract-document-panel iframe.contract-pdf-frame"
    );
    try {
      return frame?.contentDocument?.body?.innerText?.trim() || "";
    } catch {
      return "";
    }
  };

  const findLabeledValue = (lines, aliases) => {
    const aliasList = aliases.map((alias) => alias.toLocaleLowerCase());
    for (const line of lines) {
      const separator = line.search(/[:：]/);
      if (separator < 0) continue;
      const label = normalizeText(line.slice(0, separator)).toLocaleLowerCase();
      if (!aliasList.includes(label)) continue;
      const value = normalizeText(line.slice(separator + 1));
      if (value) return value;
    }
    return "";
  };

  const parseDocumentFields = (
    documentText,
    contractId,
    defaults,
    confirmedUploadFields = {}
  ) => {
    const lines = documentText
      .split(/\r?\n/)
      .map(normalizeText)
      .filter(Boolean);
    const fields = {};

    Object.values(FIELD_DEFINITIONS).forEach((definition) => {
      let value =
        definition.key === "contractNumber"
          ? contractId
          : findLabeledValue(lines, definition.aliases);
      if (definition.secondaryAliases) {
        const secondaryValue = findLabeledValue(
          lines,
          definition.secondaryAliases
        );
        value = [value, secondaryValue].filter(Boolean).join(" · ");
      }
      if (!value && defaults[definition.key]) {
        value = defaults[definition.key].value;
      }
      if (!value || isPlaceholder(value)) value = "待补充";
      fields[definition.key] = {
        value,
        source:
          definition.key === "contractNumber"
            ? "系统字段"
            : value === "待补充"
              ? "未识别 · 请人工补充"
              : definition.source,
        status: value === "待补充" ? "missing" : "detected",
      };
    });

    Object.entries(confirmedUploadFields).forEach(([key, confirmedField]) => {
      if (!fields[key] || isPlaceholder(confirmedField?.value)) return;
      fields[key] = {
        value: confirmedField.value,
        source: `${confirmedField.source || "上传表单"} · 上传前已确认`,
        status: "detected",
      };
    });

    return fields;
  };

  const showToast = (title, message, tone = "success") => {
    document.querySelector(".crw-toast")?.remove();
    window.clearTimeout(toastTimer);
    const toast = document.createElement("div");
    toast.className = `crw-toast ${tone === "warning" ? "crw-toast-warning" : ""}`;
    toast.setAttribute("role", "status");
    const copy = document.createElement("div");
    const strong = document.createElement("strong");
    const small = document.createElement("small");
    strong.textContent = title;
    small.textContent = message;
    copy.append(strong, small);
    toast.append(copy);
    document.body.append(toast);
    toastTimer = window.setTimeout(() => toast.remove(), 3600);
  };

  const scheduleParse = (context, state) => {
    if (parseTimers.has(context.contractId)) return;
    let attempts = 0;
    const finish = () => {
      if (state.phase !== "parsing") return;
      const documentText = readDocumentText();
      if (!documentText && attempts < 8) {
        attempts += 1;
        parseTimers.set(context.contractId, window.setTimeout(finish, 300));
        return;
      }
      state.fields = parseDocumentFields(
        documentText,
        context.contractId,
        readVisibleFieldDefaults(),
        state.uploadContext?.fields
      );
      state.phase = "review";
      state.parsedAt = new Date().toISOString();
      state.revision += 1;
      parseTimers.delete(context.contractId);
      saveState(state);
      enhance();
      showToast(
        "合同解析完成",
        "请核对识别结果，必要时点击字段右侧图标修改。"
      );
    };
    parseTimers.set(context.contractId, window.setTimeout(finish, 900));
  };

  const updatePageStatus = (context, state) => {
    const metrics = context.page.querySelectorAll(".contract-metric-grid article");
    const readiness = metrics[0];
    const amountMetric = metrics[1];
    const contractStatus = metrics[2];
    const setMetric = (metric, value, description, success = false) => {
      const strong = metric?.querySelector("strong");
      const small = metric?.querySelector("small");
      if (strong && strong.textContent !== value) strong.textContent = value;
      if (small && small.textContent !== description) small.textContent = description;
      strong?.classList.toggle("crw-success-text", success);
    };

    if (state.phase === "parsing") {
      setMetric(readiness, "解析中", "正在识别合同字段与来源位置");
      setMetric(amountMetric, "识别中", "正在读取金额与币种");
      setMetric(contractStatus, "解析中", "解析完成后需要人工确认");
    } else if (state.phase === "confirmed") {
      setMetric(readiness, "可用于请款", "解析内容已人工确认", true);
      setMetric(
        amountMetric,
        state.fields.totalFees?.value || "待补充",
        isPlaceholder(state.fields.totalFees?.value)
          ? "请补充合同金额"
          : "已核对合同解析结果",
        !isPlaceholder(state.fields.totalFees?.value)
      );
      setMetric(contractStatus, "已确认", "字段准确性已由用户确认", true);
    } else {
      setMetric(readiness, "待确认", "请核对解析内容并统一确认");
      setMetric(
        amountMetric,
        state.fields.totalFees?.value || "待补充",
        isPlaceholder(state.fields.totalFees?.value)
          ? "请补充合同金额"
          : "来自合同解析结果"
      );
      setMetric(contractStatus, "待确认", "解析完成，等待人工确认");
    }

    const statusText =
      state.phase === "parsing"
        ? "解析中"
        : state.phase === "confirmed"
          ? "已确认"
          : "待确认";
    const nextSubtitle = `${context.contractId} · ${statusText}`;
    if (context.subtitle.textContent !== nextSubtitle) {
      context.subtitle.textContent = nextSubtitle;
    }
  };

  const setText = (element, text) => {
    if (element && element.textContent !== text) element.textContent = text;
  };

  const enhanceContractList = () => {
    document.querySelectorAll(".contracts-page tbody tr").forEach((row) => {
      const contractId = row.textContent?.match(/CON-UPL-[A-Z0-9-]+/)?.[0];
      if (!contractId) return;
      const state = loadState(contractId);
      if (!state) return;
      const cells = row.querySelectorAll("td");
      if (cells.length < 5) return;

      const status =
        state.phase === "parsing"
          ? "解析中"
          : state.phase === "confirmed"
            ? "已确认"
            : "待确认";
      const meta = cells[0].querySelector("strong")?.nextElementSibling;
      setText(meta, `${contractId} · ${status}`);
      setText(cells[1], state.fields.publisher?.value || "待补充");

      const [projectName = "待关联", brandName = "待识别"] = normalizeText(
        state.fields.projectBrand?.value
      ).split(" · ");
      const projectStrong = cells[2].querySelector("strong");
      setText(projectStrong, projectName);
      setText(projectStrong?.nextElementSibling, brandName);
      setText(cells[3], state.fields.totalFees?.value || "待补充");

      const readiness =
        state.phase === "parsing"
          ? "解析中"
          : state.phase === "confirmed"
            ? "可用于请款"
            : "待确认";
      setText(cells[4].firstElementChild || cells[4], readiness);
      cells[4].classList.toggle(
        "crw-list-confirmed",
        state.phase === "confirmed"
      );
    });
  };

  const createIconImage = (fileName, alt = "") => {
    const image = document.createElement("img");
    image.src = `${ICON_ROOT}/${fileName}`;
    image.alt = alt;
    return image;
  };

  const renderConfirmButton = (context, state) => {
    const actions = context.page.querySelector(".page-heading-actions");
    if (!actions) return;
    let button = actions.querySelector(".crw-confirm-button");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "button crw-confirm-button";
      button.append(
        createIconImage("circle-check-big.svg"),
        document.createElement("span")
      );
      button.addEventListener("click", () => {
        const currentContext = contractContext();
        const currentState = currentContext
          ? loadState(currentContext.contractId)
          : null;
        if (currentContext && currentState) {
          confirmReview(currentContext, currentState);
        }
      });
      const downloadAction = actions.querySelector(".contract-file-action");
      actions.insertBefore(button, downloadAction || null);
    }

    const label = button.querySelector("span");
    const isConfirmed = state.phase === "confirmed";
    button.disabled = state.phase === "parsing" || isConfirmed;
    button.classList.toggle("crw-is-confirmed", isConfirmed);
    button.setAttribute(
      "aria-label",
      state.phase === "parsing"
        ? "合同解析中"
        : isConfirmed
          ? "解析内容已确认"
          : "确认解析内容"
    );
    const nextLabel =
      state.phase === "parsing"
        ? "解析中…"
        : isConfirmed
          ? "已确认可请款"
          : "确认解析内容";
    if (label.textContent !== nextLabel) label.textContent = nextLabel;
  };

  const bannerCopy = (phase) => {
    if (phase === "parsing") {
      return {
        badge: "解析中",
        copy: "系统正在读取合同字段，完成后可逐项核对。",
      };
    }
    if (phase === "confirmed") {
      return {
        badge: "已确认",
        copy: "该合同已通过人工核对，可用于创建请款。",
      };
    }
    return {
      badge: "待确认",
      copy: "仅在点击字段右侧编辑图标后才会进入编辑状态。",
    };
  };

  const renderBanner = (content, state) => {
    const heading = content.querySelector(".contract-section-heading");
    if (!heading) return;
    let banner = content.querySelector(".crw-review-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "crw-review-banner";
      banner.append(document.createElement("span"), document.createElement("em"));
      heading.insertAdjacentElement("afterend", banner);
    }
    if (banner.previousElementSibling !== heading) {
      heading.insertAdjacentElement("afterend", banner);
    }
    const copy = bannerCopy(state.phase);
    banner.dataset.phase = state.phase;
    const copyElement = banner.querySelector("span");
    if (copyElement.textContent !== copy.copy) copyElement.textContent = copy.copy;
    const badge = banner.querySelector("em");
    badge.className = "crw-review-badge";
    if (badge.textContent !== copy.badge) badge.textContent = copy.badge;
  };

  const renderFieldRow = (row, label, definition, state) => {
    if (row.dataset.crwEditing === "true") return;
    const field = state.fields[definition.key] || {
      value: "待补充",
      source: definition.source,
      status: "missing",
    };
    const version = `${state.revision}:${state.phase}:${field.value}:${field.source}`;
    if (row.dataset.crwVersion === version) return;

    const dd = row.querySelector("dd");
    if (!dd) return;
    dd.replaceChildren();
    const line = document.createElement("div");
    line.className = "crw-field-line";
    const value = document.createElement("span");
    value.className = `crw-field-value ${isPlaceholder(field.value) ? "crw-is-missing" : ""}`;
    value.textContent = field.value;
    line.append(value);

    if (definition.editable !== false && state.phase !== "parsing") {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "crw-edit-button";
      edit.dataset.fieldKey = definition.key;
      edit.setAttribute("aria-label", `编辑${label}`);
      edit.title = `编辑${label}`;
      edit.append(createIconImage("pencil.svg"));
      edit.addEventListener("click", () =>
        openFieldEditor(row, label, definition, state)
      );
      line.append(edit);
    }

    const source = document.createElement("small");
    source.className = "crw-source";
    source.textContent =
      state.phase === "confirmed"
        ? `${field.source} · 已确认`
        : field.status === "edited"
          ? "人工修改 · 待统一确认"
          : field.source;
    dd.append(line, source);
    row.dataset.crwVersion = version;
  };

  const openFieldEditor = (row, label, definition, state) => {
    document.querySelectorAll('[data-crw-editing="true"]').forEach((editingRow) => {
      editingRow.dataset.crwEditing = "false";
      delete editingRow.dataset.crwVersion;
    });
    enhance();

    const dd = row.querySelector("dd");
    const field = state.fields[definition.key];
    if (!dd || !field) return;
    row.dataset.crwEditing = "true";
    dd.replaceChildren();
    const editor = document.createElement("div");
    editor.className = "crw-editor";
    const input = document.createElement(definition.multiline ? "textarea" : "input");
    if (!definition.multiline) input.type = "text";
    input.value = isPlaceholder(field.value) ? "" : field.value;
    input.setAttribute("aria-label", label);
    const actions = document.createElement("div");
    actions.className = "crw-editor-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "取消";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "crw-save-field";
    save.textContent = "保存";
    actions.append(cancel, save);
    editor.append(input, actions);
    dd.append(editor);

    cancel.addEventListener("click", () => {
      row.dataset.crwEditing = "false";
      delete row.dataset.crwVersion;
      enhance();
    });
    save.addEventListener("click", () => {
      const nextValue = normalizeText(input.value);
      if (!nextValue) {
        input.focus();
        showToast("内容不能为空", `请填写${label}后再保存。`, "warning");
        return;
      }
      field.value = nextValue;
      field.source = "人工修改";
      field.status = "edited";
      if (state.phase === "confirmed") {
        state.phase = "review";
        state.confirmedAt = null;
      }
      state.revision += 1;
      row.dataset.crwEditing = "false";
      delete row.dataset.crwVersion;
      saveState(state);
      enhance();
      showToast("字段已更新", `${label}已保存，请完成统一确认。`);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") cancel.click();
      if (event.key === "Enter" && !definition.multiline) save.click();
    });
    input.focus();
    input.select();
  };

  const renderFields = (context, state) => {
    const content = context.page.querySelector(".contract-inspector-content");
    if (!content) return;
    renderBanner(content, state);
    content
      .querySelectorAll(
        ".contract-definition-list > div, .contract-payment-list > div"
      )
      .forEach((row) => {
        const label = row.querySelector("dt")?.textContent?.trim();
        const definition = FIELD_DEFINITIONS[label];
        if (definition) renderFieldRow(row, label, definition, state);
      });
  };

  function confirmReview(context, state) {
    if (context.page.querySelector('[data-crw-editing="true"]')) {
      showToast(
        "请先保存正在编辑的字段",
        "保存或取消当前编辑后，才能确认解析内容。",
        "warning"
      );
      return;
    }
    const missingFields = EDITABLE_FIELDS.filter((key) =>
      isPlaceholder(state.fields[key]?.value)
    );
    if (missingFields.length) {
      showToast(
        "仍有字段待补充",
        `请补充 ${missingFields.length} 个未识别字段后再确认。`,
        "warning"
      );
      return;
    }
    state.phase = "confirmed";
    state.confirmedAt = new Date().toISOString();
    Object.values(state.fields).forEach((field) => {
      field.status = "confirmed";
    });
    state.revision += 1;
    saveState(state);
    enhance();
    showToast("解析内容已确认", "该合同现在可以用于创建请款。");
  }

  function enhance() {
    enhanceContractList();
    const context = contractContext();
    if (!context) return;
    let state = loadState(context.contractId);
    if (!state) {
      state = createState(context);
      saveState(state);
    }
    updatePageStatus(context, state);
    renderConfirmButton(context, state);
    renderFields(context, state);
    if (state.phase === "parsing") scheduleParse(context, state);
  }

  const observer = new MutationObserver(() => {
    if (observerQueued) return;
    observerQueued = true;
    queueMicrotask(() => {
      observerQueued = false;
      enhance();
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  enhance();
})();
