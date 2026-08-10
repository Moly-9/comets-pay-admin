(() => {
  "use strict";

  const DRAFT_VERSION = 1;
  const DRAFT_KEY_PREFIX = "comets-pay.project-create-draft.v1";
  const DIALOG_LABEL = "新建项目";
  const DEFAULT_PM_FALLBACK = "张咏诗";
  const CONTRACT_UPLOAD_ACCEPT = [
    ".pdf",
    ".doc",
    ".docx",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ].join(",");
  const WORD_FILE_PATTERN = /\.docx?$/i;
  const wordContractPreviews = new Map();
  const pendingWordContractPreviews = [];
  const nativeCreateObjectURL = URL.createObjectURL.bind(URL);

  let activeSession = null;
  let confirmation = null;
  let allowClose = false;
  let pendingCreation = null;
  let observerQueued = false;

  const nextFrame = () =>
    new Promise((resolve) => requestAnimationFrame(() => resolve()));

  const enhanceContractUploadInput = () => {
    const input = document.querySelector(
      '.contracts-page input.sr-only[type="file"]'
    );
    if (!input) return;
    if (input.accept !== CONTRACT_UPLOAD_ACCEPT) {
      input.accept = CONTRACT_UPLOAD_ACCEPT;
    }
    if (input.dataset.wordPreviewEnhanced !== "true") {
      input.dataset.wordPreviewEnhanced = "true";
      input.addEventListener("change", handleWordContractSelection, true);
    }
  };

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const wordPreviewDocument = (file, content, state = "ready") => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; }
      html { background: #edf0f4; }
      body {
        margin: 0;
        padding: 24px;
        color: #25272d;
        font-family: "Noto Sans SC", "PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .word-page {
        width: min(100%, 760px);
        min-height: calc(100vh - 48px);
        margin: 0 auto;
        border: 1px solid #e1e4ea;
        border-radius: 3px;
        background: #fff;
        padding: 54px 58px 64px;
        box-shadow: 0 8px 24px rgb(31 33 38 / 8%);
      }
      .word-file-name {
        margin: 0 0 28px;
        padding-bottom: 14px;
        border-bottom: 1px solid #eceef2;
        color: #858b97;
        font-size: 12px;
      }
      h1, h2, h3 { margin: 1.3em 0 .55em; color: #1f2024; line-height: 1.35; }
      h1 { font-size: 24px; }
      h2 { font-size: 20px; }
      h3 { font-size: 17px; }
      p { margin: 0 0 12px; font-family: Georgia, "Times New Roman", serif; font-size: 15px; line-height: 1.75; }
      table { width: 100%; margin: 18px 0; border-collapse: collapse; font-size: 13px; }
      td { border: 1px solid #dfe2e7; padding: 8px 10px; vertical-align: top; }
      .word-state { display: grid; min-height: 320px; place-content: center; gap: 8px; color: #777e8b; text-align: center; }
      .word-state strong { color: #383b43; font-size: 15px; }
      .word-state span { max-width: 360px; font-size: 12px; line-height: 1.6; }
      .word-state[data-state="error"] strong { color: #9b4e45; }
    </style>
  </head>
  <body>
    <main class="word-page">
      <div class="word-file-name">${escapeHtml(file.name)}</div>
      ${state === "ready" ? content : `<div class="word-state" data-state="${state}">${content}</div>`}
    </main>
  </body>
</html>`;

  const descendantsByLocalName = (node, localName) =>
    [...node.getElementsByTagName("*")].filter(
      (element) => element.localName === localName
    );

  const nodeText = (node) =>
    descendantsByLocalName(node, "t")
      .map((element) => element.textContent || "")
      .join("");

  const docxXmlToHtml = (xmlText) => {
    const xml = new DOMParser().parseFromString(xmlText, "application/xml");
    if (xml.querySelector("parsererror")) {
      throw new Error("Word 文档正文 XML 无法解析");
    }
    const body = [...xml.getElementsByTagName("*")].find(
      (element) => element.localName === "body"
    );
    if (!body) throw new Error("Word 文档缺少正文");

    const blocks = [];
    [...body.children].forEach((element) => {
      if (element.localName === "p") {
        const text = nodeText(element).trim();
        if (!text) return;
        const style = descendantsByLocalName(element, "pStyle")[0];
        const styleName =
          style?.getAttribute("w:val") || style?.getAttribute("val") || "";
        const headingMatch = styleName.match(/(?:heading|标题)\s*([1-3])?/i);
        if (headingMatch) {
          const level = Number(headingMatch[1] || 2);
          blocks.push(`<h${level}>${escapeHtml(text)}</h${level}>`);
        } else {
          blocks.push(`<p>${escapeHtml(text)}</p>`);
        }
        return;
      }

      if (element.localName === "tbl") {
        const rows = [...element.children].filter(
          (child) => child.localName === "tr"
        );
        const rowHtml = rows
          .map((row) => {
            const cells = [...row.children].filter(
              (child) => child.localName === "tc"
            );
            return `<tr>${cells
              .map((cell) => `<td>${escapeHtml(nodeText(cell).trim())}</td>`)
              .join("")}</tr>`;
          })
          .join("");
        if (rowHtml) blocks.push(`<table><tbody>${rowHtml}</tbody></table>`);
      }
    });

    if (!blocks.length) throw new Error("Word 文档中没有可展示的正文");
    return blocks.join("");
  };

  const extractDocxDocumentXml = async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let endOffset = -1;
    for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) {
      if (view.getUint32(index, true) === 0x06054b50) {
        endOffset = index;
        break;
      }
    }
    if (endOffset < 0) throw new Error("不是有效的 DOCX 文件");

    const entryCount = view.getUint16(endOffset + 10, true);
    let directoryOffset = view.getUint32(endOffset + 16, true);
    const decoder = new TextDecoder("utf-8");

    for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
      if (view.getUint32(directoryOffset, true) !== 0x02014b50) break;
      const method = view.getUint16(directoryOffset + 10, true);
      const compressedSize = view.getUint32(directoryOffset + 20, true);
      const nameLength = view.getUint16(directoryOffset + 28, true);
      const extraLength = view.getUint16(directoryOffset + 30, true);
      const commentLength = view.getUint16(directoryOffset + 32, true);
      const localOffset = view.getUint32(directoryOffset + 42, true);
      const name = decoder.decode(
        bytes.subarray(directoryOffset + 46, directoryOffset + 46 + nameLength)
      );

      if (name === "word/document.xml") {
        if (view.getUint32(localOffset, true) !== 0x04034b50) {
          throw new Error("DOCX 正文索引损坏");
        }
        const localNameLength = view.getUint16(localOffset + 26, true);
        const localExtraLength = view.getUint16(localOffset + 28, true);
        const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
        const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
        let documentBytes;
        if (method === 0) {
          documentBytes = compressed;
        } else if (method === 8) {
          const stream = new Blob([compressed])
            .stream()
            .pipeThrough(new DecompressionStream("deflate-raw"));
          documentBytes = new Uint8Array(await new Response(stream).arrayBuffer());
        } else {
          throw new Error("暂不支持该 DOCX 压缩格式");
        }
        return decoder.decode(documentBytes);
      }

      directoryOffset += 46 + nameLength + extraLength + commentLength;
    }

    throw new Error("DOCX 文件缺少 word/document.xml");
  };

  const renderWordPreview = async (record, frame) => {
    if (frame.dataset.wordPreviewReady === record.previewUrl) return;
    frame.dataset.wordPreviewReady = record.previewUrl;
    frame.title = `${record.file.name} Word 原文`;
    frame.srcdoc = wordPreviewDocument(
      record.file,
      "<strong>正在载入 Word 文档</strong><span>文件仅在当前浏览器中处理</span>",
      "loading"
    );

    if (/\.doc$/i.test(record.file.name)) {
      frame.srcdoc = wordPreviewDocument(
        record.file,
        "<strong>旧版 Word 文档</strong><span>该格式暂不支持正文解析，请点击“下载原件”使用 Word 查看。</span>",
        "error"
      );
      return;
    }

    try {
      record.contentPromise ||= extractDocxDocumentXml(record.file).then(docxXmlToHtml);
      frame.srcdoc = wordPreviewDocument(
        record.file,
        await record.contentPromise
      );
    } catch (error) {
      frame.srcdoc = wordPreviewDocument(
        record.file,
        `<strong>Word 文档暂时无法预览</strong><span>${escapeHtml(error?.message || "请下载原件查看")}</span>`,
        "error"
      );
    }
  };

  const setDownloadLabel = (anchor, label) => {
    const labelElement = anchor.querySelector("span");
    if (labelElement) {
      if (labelElement.textContent !== label) {
        labelElement.textContent = label;
      }
      return;
    }
    const textNode = [...anchor.childNodes].find(
      (node) => node.nodeType === Node.TEXT_NODE
    );
    if (textNode) {
      if (textNode.textContent !== label) textNode.textContent = label;
      return;
    }
    anchor.append(document.createTextNode(label));
  };

  const enhanceWordContractPreview = () => {
    const frame = document.querySelector(
      ".contract-document-panel iframe.contract-pdf-frame"
    );
    if (!frame) return;
    const previewUrl = frame.getAttribute("src")?.split("#toolbar=")[0] || "";
    let record = wordContractPreviews.get(previewUrl);
    if (
      !record &&
      pendingWordContractPreviews.length &&
      previewUrl.startsWith("blob:")
    ) {
      record = pendingWordContractPreviews.shift();
      record.previewUrl = previewUrl;
      wordContractPreviews.set(previewUrl, record);
    }
    if (!record) return;

    void renderWordPreview(record, frame);
    document.querySelectorAll(".contract-detail-page a").forEach((anchor) => {
      const href = anchor.getAttribute("href");
      if (
        href !== record.previewUrl &&
        anchor.dataset.wordPreviewUrl !== record.previewUrl
      ) {
        return;
      }
      anchor.dataset.wordPreviewUrl = record.previewUrl;
      anchor.href = record.originalUrl;
      anchor.download = record.file.name;
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
      setDownloadLabel(anchor, "下载原件");
    });
  };

  function handleWordContractSelection(event) {
    const input = event.currentTarget;
    if (input.dataset.wordPreviewDispatch === "true") {
      delete input.dataset.wordPreviewDispatch;
      return;
    }

    const file = input.files?.[0];
    if (!file || !WORD_FILE_PATTERN.test(file.name)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    pendingWordContractPreviews.push({
      file,
      originalUrl: nativeCreateObjectURL(file),
      previewUrl: "",
      contentPromise: null,
    });

    const previewFile = new File(
      [
        wordPreviewDocument(
          file,
          "<strong>正在载入 Word 文档</strong><span>文件仅在当前浏览器中处理</span>",
          "loading"
        ),
      ],
      file.name,
      {
        type: "text/html",
        lastModified: file.lastModified,
      }
    );
    const transfer = new DataTransfer();
    transfer.items.add(previewFile);
    input.files = transfer.files;
    input.dataset.wordPreviewDispatch = "true";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const findCreateDialog = () =>
    document.querySelector(`section[role="dialog"][aria-label="${DIALOG_LABEL}"]`);

  const getAccount = () => {
    const account = document.querySelector(".sidebar-account strong")?.textContent?.trim();
    return account || "anonymous";
  };

  const getDraftKey = () => `${DRAFT_KEY_PREFIX}:${getAccount()}`;

  const getField = (dialog, placeholder) =>
    dialog.querySelector(`[placeholder="${placeholder}"]`);

  const getCustomerField = (dialog) =>
    dialog.querySelector(
      '[placeholder="输入客户名称"], [placeholder="输入合作品牌"]'
    );

  const getFields = (dialog) => ({
    projectName: getField(dialog, "例如：秋季新品首发"),
    brand: getCustomerField(dialog),
    requestReason: getField(dialog, "填写本项目的付款背景或用途"),
  });

  const relabelCustomerField = (dialog) => {
    const input = getCustomerField(dialog);
    const label = input?.closest("label");
    const fieldLabel = label?.querySelector(":scope > span");
    if (!input || !fieldLabel) return;

    if (fieldLabel.textContent?.trim() !== "客户") {
      fieldLabel.textContent = "客户";
    }
    if (input.placeholder !== "输入客户名称") {
      input.placeholder = "输入客户名称";
    }
    if (input.getAttribute("aria-label") !== "客户") {
      input.setAttribute("aria-label", "客户");
    }
  };

  const deferProjectRelationFields = (dialog) => {
    const relationFields = [
      dialog.querySelector(".upload-box")?.closest("label"),
      dialog.querySelector(".invoice-picker")?.closest(".form-field"),
    ].filter(Boolean);

    relationFields.forEach((field) => {
      field.classList.add("cp-project-create-deferred-relation");
      field.setAttribute("aria-hidden", "true");
      field.inert = true;
    });
  };

  const requireProjectCreator = (dialog) => {
    const picker = dialog.querySelector('[data-testid="project-creator-picker"]');
    const field = picker?.closest(".form-field");
    const meta = field?.querySelector(".form-field-label-with-meta small");
    if (meta && meta.textContent?.trim() !== "必填 · 来自达人档案") {
      meta.textContent = "必填 · 来自达人档案";
    }
  };

  const syncCreateButtonState = (dialog) => {
    if (!activeSession || activeSession.dialog !== dialog) return;
    const createButton = [...dialog.querySelectorAll(".modal-footer button")].find(
      (button) => button.textContent?.trim() === "创建项目"
    );
    if (!createButton) return;
    const hasProjectName = Boolean(
      getFields(dialog).projectName?.value.trim()
    );
    createButton.disabled =
      !hasProjectName || activeSession.creatorHandles.size === 0;
  };

  const getCurrentPm = (dialog) =>
    dialog.querySelector('[role="combobox"][aria-label="选择项目PM"] .custom-select-value')
      ?.textContent?.trim() || "";

  const setControlledValue = (element, value) => {
    if (!element) return;
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const loadDraft = () => {
    try {
      const value = localStorage.getItem(getDraftKey());
      if (!value) return null;
      const draft = JSON.parse(value);
      return draft?.version === DRAFT_VERSION ? draft : null;
    } catch {
      showToast("草稿读取失败", "浏览器无法读取上次保存的项目草稿。", "error");
      return null;
    }
  };

  const removeDraft = () => {
    localStorage.removeItem(getDraftKey());
  };

  const showToast = (title, message, tone = "success", duration = 3800) => {
    document.querySelectorAll(".cp-draft-toast").forEach((toast) => toast.remove());

    const toast = document.createElement("div");
    toast.className = `cp-draft-toast cp-draft-toast-${tone}`;
    toast.setAttribute("role", tone === "error" ? "alert" : "status");
    toast.innerHTML = `
      <span class="cp-draft-toast-mark" aria-hidden="true"></span>
      <span class="cp-draft-toast-copy">
        <strong></strong>
        <small></small>
      </span>
      <button type="button" aria-label="关闭提示">×</button>
    `;
    toast.querySelector("strong").textContent = title;
    toast.querySelector("small").textContent = message;
    toast.querySelector("button").addEventListener("click", () => toast.remove());
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), duration);
  };

  const isDirty = (dialog, session = activeSession) => {
    if (!dialog || !session) return false;
    const fields = getFields(dialog);
    return Boolean(
      fields.projectName?.value.trim() ||
        fields.brand?.value.trim() ||
        fields.requestReason?.value.trim() ||
        (getCurrentPm(dialog) &&
          getCurrentPm(dialog) !== (session.initialPm || DEFAULT_PM_FALLBACK)) ||
        session.creatorHandles.size
    );
  };

  const getDraftSnapshot = (dialog) => {
    const fields = getFields(dialog);

    return {
      version: DRAFT_VERSION,
      savedAt: new Date().toISOString(),
      projectName: fields.projectName?.value.trim() || "",
      brand: fields.brand?.value.trim() || "",
      pm: getCurrentPm(dialog) || activeSession.initialPm || DEFAULT_PM_FALLBACK,
      requestReason: fields.requestReason?.value.trim() || "",
      creatorHandles: [...activeSession.creatorHandles],
    };
  };

  const forceCloseDialog = (dialog) => {
    allowClose = true;
    dialog.querySelector('.modal-header button[aria-label="关闭"]')?.click();
    queueMicrotask(() => {
      allowClose = false;
    });
  };

  const setConfirmationError = (message) => {
    const error = confirmation?.querySelector(".cp-draft-confirm-error");
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  };

  const setConfirmationBusy = (busy) => {
    if (!confirmation) return;
    confirmation.querySelectorAll("button").forEach((button) => {
      button.disabled = busy;
    });
    const saveButton = confirmation.querySelector('[data-action="save"]');
    if (saveButton) {
      saveButton.textContent = busy ? "正在保存…" : "保存草稿并退出";
    }
  };

  const closeConfirmation = () => {
    if (!confirmation) return;
    confirmation.remove();
    confirmation = null;
    if (activeSession?.dialog?.isConnected) {
      activeSession.dialog.inert = false;
      activeSession.dialog.querySelector("input, textarea, button")?.focus();
    }
  };

  const openConfirmation = (dialog) => {
    if (confirmation) return;

    dialog.inert = true;
    confirmation = document.createElement("div");
    confirmation.className = "cp-draft-confirm-backdrop";
    confirmation.innerHTML = `
      <section
        class="cp-draft-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-draft-confirm-title"
        aria-describedby="cp-draft-confirm-description"
      >
        <div class="cp-draft-confirm-copy">
          <h2 id="cp-draft-confirm-title">退出新建项目？</h2>
          <p id="cp-draft-confirm-description">当前内容尚未保存，你可以保存为草稿后退出。</p>
          <p class="cp-draft-confirm-error" role="alert" hidden></p>
        </div>
        <div class="cp-draft-confirm-actions">
          <button class="cp-draft-confirm-discard" type="button" data-action="discard">放弃并退出</button>
          <button class="cp-draft-confirm-save" type="button" data-action="save">保存草稿并退出</button>
          <button class="cp-draft-confirm-continue" type="button" data-action="continue">继续编辑</button>
        </div>
      </section>
    `;

    confirmation.addEventListener("mousedown", (event) => {
      if (event.target === confirmation) {
        event.preventDefault();
        closeConfirmation();
      }
    });

    confirmation.addEventListener("click", async (event) => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (!action) return;

      if (action === "continue") {
        closeConfirmation();
        return;
      }

      if (action === "discard") {
        try {
          removeDraft();
          closeConfirmation();
          forceCloseDialog(dialog);
        } catch {
          setConfirmationError("草稿删除失败，请重试。创建窗口仍会保留。");
        }
        return;
      }

      setConfirmationBusy(true);
      try {
        localStorage.setItem(getDraftKey(), JSON.stringify(getDraftSnapshot(dialog)));
        closeConfirmation();
        forceCloseDialog(dialog);
        showToast("项目草稿已保存", "下次新建项目时将自动恢复。");
      } catch {
        setConfirmationBusy(false);
        setConfirmationError("草稿保存失败，请重试。创建窗口仍会保留。");
      }
    });

    confirmation.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeConfirmation();
        return;
      }
      if (event.key !== "Tab") return;
      const buttons = [...confirmation.querySelectorAll("button:not(:disabled)")];
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    document.body.appendChild(confirmation);
    confirmation.querySelector('[data-action="continue"]').focus();
  };

  const attemptExit = (event, dialog) => {
    if (allowClose || !isDirty(dialog)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openConfirmation(dialog);
  };

  const choosePm = async (dialog, pm) => {
    if (!pm || getCurrentPm(dialog) === pm) return true;
    const trigger = dialog.querySelector('[role="combobox"][aria-label="选择项目PM"]');
    trigger?.click();
    await nextFrame();
    const option = [...dialog.querySelectorAll('.custom-select-menu[aria-label="选择项目PM"] [role="option"]')]
      .find((item) => item.querySelector(".custom-select-option-label")?.textContent?.trim() === pm);
    if (option) {
      option.click();
    } else if (trigger?.getAttribute("aria-expanded") === "true") {
      trigger.click();
    }
    await nextFrame();
    return Boolean(option);
  };

  const restoreCreators = async (dialog, handles) => {
    if (!handles.length) return [];
    const trigger = dialog.querySelector(".creator-picker-trigger");
    const wasOpen = trigger?.getAttribute("aria-expanded") === "true";
    if (!wasOpen) {
      trigger?.click();
      await nextFrame();
    }

    const options = [...dialog.querySelectorAll(".creator-option[data-creator-handle]")];
    const available = new Map(options.map((option) => [option.dataset.creatorHandle, option]));
    available.forEach((option, handle) => {
      const name = option.querySelector(".creator-option-profile strong")?.textContent?.trim();
      if (name) activeSession.creatorNameByHandle.set(handle, name);
    });
    const invalid = handles.filter((handle) => !available.has(handle));

    for (const handle of handles) {
      const option = available.get(handle);
      if (option && option.getAttribute("aria-selected") !== "true") {
        option.click();
        await nextFrame();
      }
    }

    activeSession.creatorHandles = new Set(handles.filter((handle) => available.has(handle)));
    const freshTrigger = dialog.querySelector(".creator-picker-trigger");
    if (!wasOpen && freshTrigger?.getAttribute("aria-expanded") === "true") {
      freshTrigger.click();
      await nextFrame();
    }
    return invalid;
  };

  const addRestoreTools = (dialog) => {
    const modalContent = dialog.querySelector(".modal-content");
    if (!modalContent || modalContent.querySelector(".cp-draft-tools")) return;

    const tools = document.createElement("div");
    tools.className = "cp-draft-tools";
    tools.innerHTML = `
      <span>正在继续上次未完成的项目草稿</span>
      <button type="button">清空并新建</button>
    `;
    tools.querySelector("button").addEventListener("click", () => clearAndStartNew(dialog));
    modalContent.prepend(tools);
  };

  const addValidationNotice = (dialog, messages) => {
    dialog.querySelector(".cp-draft-validation")?.remove();
    if (!messages.length) return;

    const notice = document.createElement("div");
    notice.className = "cp-draft-validation";
    notice.setAttribute("role", "alert");
    notice.innerHTML = `
      <strong>部分关联内容需要重新确认</strong>
      <span></span>
    `;
    notice.querySelector("span").textContent = messages.join("；");
    dialog.querySelector(".cp-draft-tools")?.after(notice);
  };

  const clearRelationSelections = async (dialog) => {
    dialog.querySelector(".creator-selection-chips .invoice-selection-clear")?.click();
    await nextFrame();
    activeSession.creatorHandles.clear();
  };

  const clearAndStartNew = async (dialog) => {
    try {
      removeDraft();
    } catch {
      showToast("无法清空草稿", "浏览器存储不可用，请稍后重试。", "error");
      return;
    }

    const fields = getFields(dialog);
    setControlledValue(fields.projectName, "");
    setControlledValue(fields.brand, "");
    setControlledValue(fields.requestReason, "");
    await choosePm(dialog, activeSession.initialPm || DEFAULT_PM_FALLBACK);
    await clearRelationSelections(dialog);

    activeSession.restored = false;
    dialog.querySelector(".cp-draft-validation")?.remove();
    dialog.querySelector(".cp-draft-tools")?.remove();

    showToast("已清空项目草稿", "现在可以新建另一个项目。");
    getFields(dialog).projectName?.focus();
  };

  const restoreDraft = async (dialog, draft) => {
    activeSession.restoring = true;
    const fields = getFields(dialog);
    setControlledValue(fields.projectName, draft.projectName || "");
    setControlledValue(fields.brand, draft.brand || "");
    setControlledValue(fields.requestReason, draft.requestReason || "");
    await nextFrame();

    const pmValid = await choosePm(dialog, draft.pm);
    const invalidCreators = await restoreCreators(dialog, draft.creatorHandles || []);
    const validationMessages = [];

    if (!pmValid && draft.pm) {
      validationMessages.push(`项目 PM“${draft.pm}”已失效，请重新选择`);
    }
    if (invalidCreators.length) {
      validationMessages.push(`${invalidCreators.length} 位达人已失效，请重新选择`);
    }

    activeSession.restoring = false;
    activeSession.restored = true;
    addRestoreTools(dialog);
    addValidationNotice(dialog, validationMessages);
    showToast("已恢复上次未完成的项目草稿", "请确认关联对象仍然有效。");
  };

  const enhanceDialog = async (dialog) => {
    relabelCustomerField(dialog);
    deferProjectRelationFields(dialog);
    requireProjectCreator(dialog);
    if (dialog.dataset.projectDraftGuard === "ready") {
      syncCreateButtonState(dialog);
      return;
    }
    dialog.dataset.projectDraftGuard = "ready";

    activeSession = {
      dialog,
      initialPm: getCurrentPm(dialog) || DEFAULT_PM_FALLBACK,
      creatorHandles: new Set(),
      creatorNameByHandle: new Map(),
      restoring: false,
      restored: false,
    };
    getFields(dialog).projectName?.addEventListener("input", () => {
      queueMicrotask(() => syncCreateButtonState(dialog));
    });
    syncCreateButtonState(dialog);

    const draft = loadDraft();
    if (draft) {
      try {
        await restoreDraft(dialog, draft);
      } catch {
        activeSession.restoring = false;
        showToast("草稿恢复失败", "表单仍可继续编辑，请重新选择关联对象。", "error");
      }
      syncCreateButtonState(dialog);
    }
  };

  const checkCreationSuccess = () => {
    if (!pendingCreation || findCreateDialog()) return;
    const createdToast = [...document.querySelectorAll(".toast strong")].some(
      (element) => element.textContent?.trim() === "项目已创建"
    );
    const createdProjectRow = [...document.querySelectorAll(".data-table tbody tr strong")].some(
      (element) => element.textContent?.trim() === pendingCreation.projectName
    );
    if (!createdToast && !createdProjectRow) return;
    try {
      localStorage.removeItem(pendingCreation.draftKey);
    } catch {
      // Project creation has already succeeded; stale draft cleanup can be retried manually.
    }
    pendingCreation = null;
  };

  const syncSelectedStateFromClick = (event, dialog) => {
    if (!activeSession || activeSession.restoring) return;

    const creatorOption = event.target.closest(".creator-option[data-creator-handle]");
    if (creatorOption && dialog.contains(creatorOption)) {
      const handle = creatorOption.dataset.creatorHandle;
      const name = creatorOption
        .querySelector(".creator-option-profile strong")
        ?.textContent?.trim();
      if (name) activeSession.creatorNameByHandle.set(handle, name);
      if (creatorOption.getAttribute("aria-selected") === "true") {
        activeSession.creatorHandles.delete(handle);
      } else {
        activeSession.creatorHandles.add(handle);
      }
      return;
    }

    if (event.target.closest(".creator-selection-chips .invoice-selection-clear")) {
      activeSession.creatorHandles.clear();
      return;
    }

    const removeCreator = event.target.closest('[aria-label^="移除 "]');
    if (removeCreator && dialog.contains(removeCreator)) {
      const name = removeCreator.getAttribute("aria-label").replace(/^移除\s*/, "");
      const handle = [...activeSession.creatorNameByHandle.entries()].find(
        ([, creatorName]) => creatorName === name
      )?.[0];
      if (handle) activeSession.creatorHandles.delete(handle);
    }
  };

  document.addEventListener(
    "mousedown",
    (event) => {
      const dialog = findCreateDialog();
      if (!dialog) return;
      const backdrop = dialog.closest(".modal-backdrop");
      if (event.target === backdrop) {
        attemptExit(event, dialog);
      }
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      const dialog = findCreateDialog();
      if (!dialog) return;

      syncSelectedStateFromClick(event, dialog);
      queueMicrotask(() => syncCreateButtonState(dialog));

      const closeButton = event.target.closest('.modal-header button[aria-label="关闭"]');
      const cancelButton = [...dialog.querySelectorAll(".modal-footer button")].find(
        (button) => button.textContent?.trim() === "取消"
      );
      if (closeButton || (cancelButton && cancelButton.contains(event.target))) {
        attemptExit(event, dialog);
        return;
      }

      const createButton = [...dialog.querySelectorAll(".modal-footer button")].find(
        (button) => button.textContent?.trim() === "创建项目"
      );
      if (
        createButton &&
        createButton.contains(event.target) &&
        activeSession.creatorHandles.size === 0
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showToast("请选择合作达人", "项目至少需要关联 1 位达人。", "error");
        syncCreateButtonState(dialog);
        return;
      }
      if (createButton && createButton.contains(event.target) && !createButton.disabled) {
        pendingCreation = {
          draftKey: getDraftKey(),
          projectName: getFields(dialog).projectName?.value.trim() || "",
        };
        window.setTimeout(checkCreationSuccess, 0);
        window.setTimeout(checkCreationSuccess, 120);
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape" || confirmation) return;
      const dialog = findCreateDialog();
      if (!dialog) return;
      if (dialog.querySelector(".custom-select-open")) return;
      attemptExit(event, dialog);
      if (!isDirty(dialog)) {
        forceCloseDialog(dialog);
      }
    },
    true
  );

  const observer = new MutationObserver(() => {
    if (observerQueued) return;
    observerQueued = true;
    queueMicrotask(() => {
      observerQueued = false;
      enhanceContractUploadInput();
      enhanceWordContractPreview();
      const dialog = findCreateDialog();
      if (dialog) {
        void enhanceDialog(dialog);
        if (activeSession?.restored) addRestoreTools(dialog);
      } else if (activeSession) {
        activeSession = null;
        closeConfirmation();
      }
      checkCreationSuccess();
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  enhanceContractUploadInput();
  enhanceWordContractPreview();
  const existingDialog = findCreateDialog();
  if (existingDialog) void enhanceDialog(existingDialog);
})();
