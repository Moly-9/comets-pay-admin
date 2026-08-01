(() => {
  "use strict";

  const DRAFT_VERSION = 1;
  const DRAFT_KEY_PREFIX = "comets-pay.project-create-draft.v1";
  const DIALOG_LABEL = "新建项目";
  const DEFAULT_PM_FALLBACK = "张咏诗";

  let activeSession = null;
  let confirmation = null;
  let allowClose = false;
  let pendingCreation = null;
  let observerQueued = false;

  const nextFrame = () =>
    new Promise((resolve) => requestAnimationFrame(() => resolve()));

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
    requestReason: getField(dialog, "填写本项目的请款背景或用途"),
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
        session.creatorHandles.size ||
        session.invoiceIds.size ||
        session.contract ||
        session.contractDraftReference
    );
  };

  const getDraftSnapshot = (dialog) => {
    const fields = getFields(dialog);
    const contract = activeSession.contract
      ? {
          hadSelection: true,
          name: activeSession.contract.name,
          type: activeSession.contract.type,
        }
      : activeSession.contractDraftReference || { hadSelection: false };

    return {
      version: DRAFT_VERSION,
      savedAt: new Date().toISOString(),
      projectName: fields.projectName?.value.trim() || "",
      brand: fields.brand?.value.trim() || "",
      pm: getCurrentPm(dialog) || activeSession.initialPm || DEFAULT_PM_FALLBACK,
      requestReason: fields.requestReason?.value.trim() || "",
      creatorHandles: [...activeSession.creatorHandles],
      invoiceIds: [...activeSession.invoiceIds],
      contract,
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

  const restoreInvoices = async (dialog, ids) => {
    if (!ids.length) return [];
    const trigger = dialog.querySelector(".invoice-picker > .invoice-picker-trigger");
    const wasOpen = trigger?.getAttribute("aria-expanded") === "true";
    if (!wasOpen) {
      trigger?.click();
      await nextFrame();
    }

    const options = [...dialog.querySelectorAll("#project-invoice-options .invoice-option")];
    const available = new Map(
      options.map((option) => [option.querySelector("strong")?.textContent?.trim(), option])
    );
    const invalid = ids.filter((id) => !available.has(id));

    for (const id of ids) {
      const option = available.get(id);
      if (option && option.getAttribute("aria-selected") !== "true") {
        option.click();
        await nextFrame();
      }
    }

    activeSession.invoiceIds = new Set(ids.filter((id) => available.has(id)));
    const freshTrigger = dialog.querySelector(".invoice-picker > .invoice-picker-trigger");
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
    activeSession.validationMessages = messages;
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
    dialog.querySelector(".invoice-picker + .invoice-selection-clear")?.click();
    await nextFrame();
    activeSession.creatorHandles.clear();
    activeSession.invoiceIds.clear();
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

    activeSession.contract = null;
    activeSession.contractDraftReference = null;
    activeSession.restored = false;
    document.querySelector(".cp-contract-file-input")?.remove();
    dialog.querySelector(".cp-contract-selection")?.remove();
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
    const invalidInvoices = await restoreInvoices(dialog, draft.invoiceIds || []);
    const validationMessages = [];

    if (!pmValid && draft.pm) {
      validationMessages.push(`项目 PM“${draft.pm}”已失效，请重新选择`);
    }
    if (invalidCreators.length) {
      validationMessages.push(`${invalidCreators.length} 位达人已失效，请重新选择`);
    }
    if (invalidInvoices.length) {
      validationMessages.push(`${invalidInvoices.length} 份 Invoice 已失效，请重新选择`);
    }
    if (draft.contract?.hadSelection) {
      activeSession.contractDraftReference = draft.contract;
      validationMessages.push(
        `合同文件“${draft.contract.name || "未命名文件"}”需重新选择`
      );
    }

    activeSession.restoring = false;
    activeSession.restored = true;
    addRestoreTools(dialog);
    addValidationNotice(dialog, validationMessages);
    showToast("已恢复上次未完成的项目草稿", "请确认关联对象仍然有效。");
  };

  const showContractSelection = (dialog) => {
    const existing = dialog.querySelector(".cp-contract-selection");
    if (!activeSession.contract) return;
    if (existing?.querySelector("span")?.textContent === activeSession.contract.name) {
      return;
    }
    existing?.remove();

    const uploadButton = dialog.querySelector(".upload-box");
    const selection = document.createElement("div");
    selection.className = "cp-contract-selection";
    selection.innerHTML = `
      <span></span>
      <button type="button">移除</button>
    `;
    selection.querySelector("span").textContent = activeSession.contract.name;
    selection.querySelector("button").addEventListener("click", () => {
      activeSession.contract = null;
      activeSession.contractDraftReference = null;
      selection.remove();
    });
    uploadButton?.after(selection);
  };

  const openContractPicker = (dialog) => {
    document.querySelector(".cp-contract-file-input")?.remove();
    const input = document.createElement("input");
    input.className = "cp-contract-file-input";
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.hidden = true;
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      activeSession.contract = { name: file.name, type: file.type || "application/pdf" };
      activeSession.contractDraftReference = null;
      showContractSelection(dialog);
      const messages = (activeSession.validationMessages || []).filter(
        (message) => !message.includes("合同文件")
      );
      addValidationNotice(dialog, messages);
    });
    document.body.appendChild(input);
    input.click();
  };

  const enhanceDialog = async (dialog) => {
    relabelCustomerField(dialog);
    if (dialog.dataset.projectDraftGuard === "ready") return;
    dialog.dataset.projectDraftGuard = "ready";

    activeSession = {
      dialog,
      initialPm: getCurrentPm(dialog) || DEFAULT_PM_FALLBACK,
      creatorHandles: new Set(),
      creatorNameByHandle: new Map(),
      invoiceIds: new Set(),
      contract: null,
      contractDraftReference: null,
      validationMessages: [],
      restoring: false,
      restored: false,
    };

    const draft = loadDraft();
    if (draft) {
      try {
        await restoreDraft(dialog, draft);
      } catch {
        activeSession.restoring = false;
        showToast("草稿恢复失败", "表单仍可继续编辑，请重新选择关联对象。", "error");
      }
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

    const invoiceOption = event.target.closest("#project-invoice-options .invoice-option");
    if (invoiceOption && dialog.contains(invoiceOption)) {
      const id = invoiceOption.querySelector("strong")?.textContent?.trim();
      if (!id) return;
      if (invoiceOption.getAttribute("aria-selected") === "true") {
        activeSession.invoiceIds.delete(id);
      } else {
        activeSession.invoiceIds.add(id);
      }
      return;
    }

    if (event.target.closest(".creator-selection-chips .invoice-selection-clear")) {
      activeSession.creatorHandles.clear();
      return;
    }
    if (event.target.closest(".invoice-picker + .invoice-selection-clear")) {
      activeSession.invoiceIds.clear();
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

      const closeButton = event.target.closest('.modal-header button[aria-label="关闭"]');
      const cancelButton = [...dialog.querySelectorAll(".modal-footer button")].find(
        (button) => button.textContent?.trim() === "取消"
      );
      if (closeButton || (cancelButton && cancelButton.contains(event.target))) {
        attemptExit(event, dialog);
        return;
      }

      const uploadButton = event.target.closest(".upload-box");
      if (uploadButton && dialog.contains(uploadButton)) {
        event.preventDefault();
        event.stopPropagation();
        openContractPicker(dialog);
        return;
      }

      const createButton = [...dialog.querySelectorAll(".modal-footer button")].find(
        (button) => button.textContent?.trim() === "创建项目"
      );
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
      const dialog = findCreateDialog();
      if (dialog) {
        void enhanceDialog(dialog);
        if (activeSession?.contract) showContractSelection(dialog);
        if (activeSession?.restored) addRestoreTools(dialog);
      } else if (activeSession) {
        activeSession = null;
        closeConfirmation();
        document.querySelector(".cp-contract-file-input")?.remove();
      }
      checkCreationSuccess();
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  const existingDialog = findCreateDialog();
  if (existingDialog) void enhanceDialog(existingDialog);
})();
