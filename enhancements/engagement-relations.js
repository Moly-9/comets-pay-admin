(() => {
  "use strict";

  const STORE_KEY = "comets-pay.engagement-relations.v2";
  const STORE_VERSION = 2;
  const CONTRACT_REVIEW_PREFIX = "comets-pay.contract-review.v1:";
  const ENGAGEMENT_ID_PATTERN = /^ENG-[A-Z0-9-]+$/;
  const PROJECT_ID_PATTERN = /^PRJ-\d{6}(?:-\d{2})?$/;
  const PROJECT_ID_SEARCH_PATTERN = /PRJ-\d{6}(?:-\d{2})?/;
  const CONTRACT_ID_PATTERN = /CON-[A-Z0-9-]+/;

  const BASE_PROJECTS = [
    ["PRJ-301164", "#301164 DCD欧美&东南亚地区创作者生态项目（26年4-6月）", "网易"],
    ["PRJ-260727-02", "燕云十六声", "NetEase Games"],
    ["PRJ-260727-03", "Once Human主机上线KOL合作项目", "网易"],
    ["PRJ-260727-04", "原神-欧美KOC-6.7版本", "米哈游"],
    ["PRJ-260727-05", "恋与深空欧美KOC - 7月", "Infolder Games"],
    ["PRJ-260727-06", "永劫无间欧美竞品生态KOC 2026.07 - 2026.08", "NetEase Games"],
    ["PRJ-260727-07", "Racing Master NA/EU KOC 4-6月", "网易游戏"],
    ["PRJ-260727-08", "Marvel Rivals S8前瞻直播", "网易"],
    ["PRJ-260727-09", "永劫无间欧美竞品生态KOC 2026.06 - 2026.07", "NetEase Games"],
    ["PRJ-260727-10", "杖剑传说KOL", "雷霆游戏"],
    ["PRJ-260727-11", "逆水寒测试项目", "网易游戏"],
    ["PRJ-260727-12", "巅峰极速欧美KOL", "网易"],
    ["PRJ-260801-01", "蛋仔派对欧美KOL创作者项目（2026年8月）", "网易"],
    ["PRJ-260801-02", "第五人格全球创作者合作计划 S41", "网易游戏"],
    ["PRJ-260801-03", "漫威争锋 S9 欧美直播合作", "网易"],
    ["PRJ-260801-04", "七日世界东南亚 KOC 口碑项目", "NetEase Games"],
    ["PRJ-260801-05", "荒野行动日韩创作者合作（2026 Q2）", "网易游戏"],
    ["PRJ-260801-06", "萤火突击欧美 KOL 内容合作", "NetEase Games"],
    ["PRJ-260801-07", "逆水寒手游海外主播测试项目", "网易游戏"],
    ["PRJ-260801-08", "永劫无间东南亚 KOC（2026年8月）", "NetEase Games"],
  ].map(([projectId, projectName, customer]) => ({
    projectId,
    projectName,
    customer,
  }));

  const BASE_CREATORS = [
    ["creator-mina", "Mina Kato", "@MinaKato"],
    ["creator-alex", "Alex Ruiz", "@alexbuilds"],
    ["creator-nika", "Nika Petrova", "@nika.spark"],
    ["creator-luna", "Luna Jones", "@Luna_J"],
    ["creator-yuki", "Yuki Tanaka", "@yuki.tokyo"],
    ["creator-camila", "Camila Costa", "@camila.beauty"],
    ["creator-oliver", "Oliver Chen", "@oliver.tech"],
    ["creator-hannah", "Hannah Lee", "@hannah.home"],
    ["creator-luca", "Luca Bianchi", "@luca.style"],
    ["creator-emily", "Emily Wong", "@emily.travel"],
    ["creator-kenji", "Kenji Mori", "@kenji.moves"],
    ["creator-sofia", "Sofia Martinez", "@sofia.daily"],
    ["creator-marc", "Marc Olivier", "@marcframes"],
  ].map(([creatorId, creatorName, handle]) => ({
    creatorId,
    creatorName,
    handle,
  }));

  let pendingInvoiceRelation = null;
  let observerQueued = false;
  let relationNoticeTimer = 0;

  const normalizeText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();

  const createEmptyStore = () => ({
    version: STORE_VERSION,
    projects: {},
    creators: {},
    engagements: {},
    invoices: {},
    contracts: {},
  });

  const readStore = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (parsed?.version !== STORE_VERSION) return createEmptyStore();
      return {
        version: STORE_VERSION,
        projects:
          parsed.projects && typeof parsed.projects === "object"
            ? parsed.projects
            : {},
        creators:
          parsed.creators && typeof parsed.creators === "object"
            ? parsed.creators
            : {},
        engagements:
          parsed.engagements && typeof parsed.engagements === "object"
            ? parsed.engagements
            : {},
        invoices:
          parsed.invoices && typeof parsed.invoices === "object"
            ? parsed.invoices
            : {},
        contracts:
          parsed.contracts && typeof parsed.contracts === "object"
            ? parsed.contracts
            : {},
      };
    } catch {
      return createEmptyStore();
    }
  };

  const writeStore = (store) => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      return true;
    } catch {
      return false;
    }
  };

  const generateUuid = () => {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const random = new Uint32Array(4);
    crypto.getRandomValues(random);
    return [
      Date.now().toString(36),
      ...random.map((value) => value.toString(36)),
    ]
      .join("-")
      .toLowerCase();
  };

  const generateEngagementId = () => `ENG-${generateUuid().toUpperCase()}`;

  const generateUniqueEngagementId = (store) => {
    const usedIds = new Set(
      Object.values(store.engagements)
        .map((engagement) => engagement?.engagementId)
        .filter(Boolean)
    );
    let engagementId = generateEngagementId();
    while (usedIds.has(engagementId)) engagementId = generateEngagementId();
    return engagementId;
  };

  const normalizeProject = (project) => {
    const projectId = normalizeText(project?.projectId || project?.id);
    const projectName = normalizeText(project?.projectName || project?.name);
    if (!PROJECT_ID_PATTERN.test(projectId) || !projectName) return null;
    return {
      projectId,
      projectName,
      customer: normalizeText(
        project?.customer || project?.brand || project?.client
      ),
    };
  };

  const resolveCreator = (creator, store) => {
    const suppliedId = normalizeText(creator?.creatorId || creator?.id);
    const suppliedName = normalizeText(creator?.creatorName || creator?.name);
    const suppliedHandle = normalizeText(creator?.handle);
    if (!suppliedId && !suppliedName && !suppliedHandle) return null;

    const knownCreators = [
      ...Object.values(store.creators),
      ...BASE_CREATORS,
    ];
    const existing =
      (suppliedId &&
        knownCreators.find((candidate) => candidate.creatorId === suppliedId)) ||
      (suppliedHandle &&
        knownCreators.find(
          (candidate) =>
            normalizeText(candidate.handle).toLocaleLowerCase() ===
            suppliedHandle.toLocaleLowerCase()
        )) ||
      (suppliedName &&
        knownCreators.find(
          (candidate) =>
            normalizeText(candidate.creatorName).toLocaleLowerCase() ===
            suppliedName.toLocaleLowerCase()
        ));
    const creatorId = suppliedId || existing?.creatorId || generateUuid();
    const creatorName = suppliedName || normalizeText(existing?.creatorName);
    if (!creatorId || !creatorName) return null;
    return {
      creatorId,
      creatorName,
      handle: suppliedHandle || normalizeText(existing?.handle),
    };
  };

  const ensureProject = (project) => {
    const normalized = normalizeProject(project);
    if (!normalized) return null;
    const store = readStore();
    const existing = store.projects[normalized.projectId];
    const now = new Date().toISOString();
    const next = {
      projectId: normalized.projectId,
      projectName: normalized.projectName,
      customer: normalized.customer || existing?.customer || "",
      createdAt: existing?.createdAt || now,
      updatedAt: existing?.updatedAt || now,
    };
    const changed =
      !existing ||
      existing.projectName !== next.projectName ||
      existing.customer !== next.customer;
    if (changed) {
      next.updatedAt = now;
      store.projects[next.projectId] = next;
      writeStore(store);
    }
    return changed ? next : existing;
  };

  const ensureCreator = (creator) => {
    const store = readStore();
    const normalized = resolveCreator(creator, store);
    if (!normalized) return null;
    const existing = store.creators[normalized.creatorId];
    const now = new Date().toISOString();
    const next = {
      creatorId: normalized.creatorId,
      creatorName: normalized.creatorName,
      handle: normalized.handle || existing?.handle || "",
      createdAt: existing?.createdAt || now,
      updatedAt: existing?.updatedAt || now,
    };
    const changed =
      !existing ||
      existing.creatorName !== next.creatorName ||
      existing.handle !== next.handle;
    if (changed) {
      next.updatedAt = now;
      store.creators[next.creatorId] = next;
      writeStore(store);
    }
    return changed ? next : existing;
  };

  const engagementKey = (projectId, creatorId) =>
    `${projectId}::${creatorId}`;

  const ensureEngagement = (project, creator, preferredEngagementId = "") => {
    const storedProject = ensureProject(project);
    const storedCreator = ensureCreator(creator);
    if (!storedProject || !storedCreator) return null;

    const store = readStore();
    const key = engagementKey(
      storedProject.projectId,
      storedCreator.creatorId
    );
    const existing = store.engagements[key];
    const existingIdIsUnique =
      ENGAGEMENT_ID_PATTERN.test(existing?.engagementId || "") &&
      !Object.values(store.engagements).some(
        (engagement) =>
          engagement !== existing &&
          engagement?.engagementId === existing.engagementId
      );
    const normalizedPreferredId = normalizeText(preferredEngagementId);
    const preferredIdIsAvailable =
      ENGAGEMENT_ID_PATTERN.test(normalizedPreferredId) &&
      !Object.values(store.engagements).some(
        (engagement) =>
          engagement !== existing &&
          engagement?.engagementId === normalizedPreferredId
      );
    const now = new Date().toISOString();
    const next = {
      engagementId: existingIdIsUnique
        ? existing.engagementId
        : preferredIdIsAvailable
          ? normalizedPreferredId
          : generateUniqueEngagementId(store),
      projectId: storedProject.projectId,
      projectName: storedProject.projectName,
      customer: storedProject.customer,
      creatorId: storedCreator.creatorId,
      creatorName: storedCreator.creatorName,
      creatorHandle: storedCreator.handle,
      createdAt: existing?.createdAt || now,
      updatedAt: existing?.updatedAt || now,
    };
    const changed =
      !existing ||
      existing.engagementId !== next.engagementId ||
      existing.projectName !== next.projectName ||
      existing.customer !== next.customer ||
      existing.creatorName !== next.creatorName ||
      existing.creatorHandle !== next.creatorHandle;
    if (changed) {
      next.updatedAt = now;
      store.engagements[key] = next;
      writeStore(store);
      document.dispatchEvent(
        new CustomEvent("comets-pay:engagement-changed", {
          detail: { ...next },
        })
      );
    }
    return changed ? next : existing;
  };

  const findProjectByName = (projectName) => {
    const normalizedName = normalizeText(projectName);
    if (!normalizedName) return null;
    const stored = Object.values(readStore().projects).find(
      (project) => normalizeText(project.projectName) === normalizedName
    );
    if (stored) return stored;
    const baseProject = BASE_PROJECTS.find(
      (project) => normalizeText(project.projectName) === normalizedName
    );
    return baseProject ? ensureProject(baseProject) : null;
  };

  const getProject = (projectId) =>
    readStore().projects[normalizeText(projectId)] || null;

  const listProjects = () => {
    const projects = new Map(
      BASE_PROJECTS.map((project) => [project.projectId, project])
    );
    Object.values(readStore().projects).forEach((project) => {
      if (!PROJECT_ID_PATTERN.test(project.projectId)) return;
      projects.set(project.projectId, {
        projectId: project.projectId,
        projectName: project.projectName,
        customer: project.customer,
      });
    });
    return [...projects.values()];
  };

  const listProjectEngagements = (projectId) => {
    const normalizedId = normalizeText(projectId);
    return Object.values(readStore().engagements).filter(
      (engagement) => engagement.projectId === normalizedId
    );
  };

  const creatorForProject = (projectId, creatorName) => {
    const normalizedName = normalizeText(creatorName);
    const engagement = listProjectEngagements(projectId).find(
      (candidate) => normalizeText(candidate.creatorName) === normalizedName
    );
    return engagement
      ? {
          creatorId: engagement.creatorId,
          creatorName: engagement.creatorName,
          handle: engagement.creatorHandle,
        }
      : { creatorName: normalizedName };
  };

  const relationStoreKey = (entityType) =>
    entityType === "invoice" ? "invoices" : "contracts";

  const recordRelation = (
    entityType,
    entityId,
    project,
    creator,
    preferredEngagementId = ""
  ) => {
    const normalizedEntityId = normalizeText(entityId);
    if (!normalizedEntityId) return null;
    const engagement = ensureEngagement(
      project,
      creator,
      preferredEngagementId
    );
    if (!engagement) return null;

    const store = readStore();
    const collection = relationStoreKey(entityType);
    const existing = store[collection][normalizedEntityId];
    if (
      existing?.engagementId === engagement.engagementId &&
      existing?.projectId === engagement.projectId &&
      existing?.creatorId === engagement.creatorId
    ) {
      return existing;
    }

    const relation = {
      entityType,
      entityId: normalizedEntityId,
      engagementId: engagement.engagementId,
      projectId: engagement.projectId,
      projectName: engagement.projectName,
      creatorId: engagement.creatorId,
      creatorName: engagement.creatorName,
      linkedAt: new Date().toISOString(),
    };
    store[collection][normalizedEntityId] = relation;
    writeStore(store);
    document.dispatchEvent(
      new CustomEvent("comets-pay:engagement-linked", {
        detail: { ...relation },
      })
    );
    return relation;
  };

  const readContractReviewState = (contractId) => {
    const normalizedId = normalizeText(contractId);
    if (!normalizedId) return null;
    try {
      const parsed = JSON.parse(
        localStorage.getItem(`${CONTRACT_REVIEW_PREFIX}${normalizedId}`) ||
          "null"
      );
      return parsed?.version === 1 && parsed.contractId === normalizedId
        ? parsed
        : null;
    } catch {
      return null;
    }
  };

  const listContractReviewStates = () => {
    const states = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith(CONTRACT_REVIEW_PREFIX)) continue;
        const contractId = key.slice(CONTRACT_REVIEW_PREFIX.length);
        const state = readContractReviewState(contractId);
        if (state) states.push(state);
      }
    } catch {
      return states;
    }
    return states;
  };

  const repairStoredContractRelations = () => {
    listContractReviewStates().forEach((state) => {
      const project = state.uploadContext?.project;
      const creator = state.uploadContext?.creator;
      if (!project || !creator) return;
      const relation = recordRelation(
        "contract",
        state.contractId,
        project,
        creator,
        state.engagementId || state.uploadContext?.engagementId
      );
      if (!relation || state.engagementId === relation.engagementId) return;
      try {
        localStorage.setItem(
          `${CONTRACT_REVIEW_PREFIX}${state.contractId}`,
          JSON.stringify({
            ...state,
            engagementId: relation.engagementId,
          })
        );
      } catch {
        // The repaired relation remains usable for the current page session.
      }
    });
  };

  const contractStatus = (state) => {
    if (state?.phase === "confirmed") return "可用于请款";
    if (state?.phase === "parsing") return "解析中";
    if (state?.phase === "review") return "待确认";
    return "已关联";
  };

  const listProjectContracts = (projectId) => {
    repairStoredContractRelations();
    const normalizedId = normalizeText(projectId);
    if (!PROJECT_ID_PATTERN.test(normalizedId)) return [];
    const store = readStore();
    const engagementIds = new Set(
      Object.values(store.engagements)
        .filter((engagement) => engagement.projectId === normalizedId)
        .map((engagement) => engagement.engagementId)
    );
    return Object.values(store.contracts)
      .filter((relation) => engagementIds.has(relation.engagementId))
      .map((relation) => {
        const state = readContractReviewState(relation.entityId);
        return {
          ...relation,
          contractId: relation.entityId,
          contractName: normalizeText(state?.fileName) || relation.entityId,
          amount: normalizeText(state?.fields?.totalFees?.value),
          phase: state?.phase || "linked",
          status: contractStatus(state),
        };
      })
      .sort((left, right) =>
        normalizeText(right.linkedAt).localeCompare(
          normalizeText(left.linkedAt)
        )
      );
  };

  const projectFromRow = (row) => {
    const cells = row.querySelectorAll("td");
    const projectId = normalizeText(
      cells[0]?.querySelector(".cell-subtext")?.textContent
    );
    const projectName = cells[0]?.querySelector("strong")?.textContent?.trim();
    if (!PROJECT_ID_PATTERN.test(projectId) || !projectName) return null;
    return {
      projectId,
      projectName,
      customer: cells[1]?.textContent?.trim() || "",
    };
  };

  const projectsPage = () =>
    [...document.querySelectorAll(".page-stack")].find(
      (page) =>
        page.querySelector(":scope > .page-heading-row h1")?.textContent?.trim() ===
        "我的项目"
    );

  const applyProjectEngagementAttributes = (element, projectId) => {
    if (!element) return;
    const engagementIds = listProjectEngagements(projectId).map(
      (engagement) => engagement.engagementId
    );
    if (!engagementIds.length) {
      delete element.dataset.engagementId;
      delete element.dataset.engagementIds;
      return;
    }
    element.dataset.engagementIds = engagementIds.join(" ");
    if (engagementIds.length === 1) {
      element.dataset.engagementId = engagementIds[0];
    } else {
      delete element.dataset.engagementId;
    }
  };

  const registerVisibleProjects = () => {
    projectsPage()?.querySelectorAll(".data-table tbody tr").forEach((row) => {
      const project = projectFromRow(row);
      const storedProject = project ? ensureProject(project) : null;
      if (storedProject) {
        applyProjectEngagementAttributes(row, storedProject.projectId);
      }
    });

    const detailPage = document.querySelector(".project-detail-page");
    const subtitle = detailPage?.querySelector(
      ":scope > .page-heading-row p"
    )?.textContent;
    const projectId = normalizeText(subtitle).match(
      PROJECT_ID_SEARCH_PATTERN
    )?.[0];
    if (detailPage && projectId) {
      applyProjectEngagementAttributes(detailPage, projectId);
    }
  };

  const createProjectContractRow = (
    template,
    contract,
    index,
    total
  ) => {
    const row = document.createElement("article");
    row.className =
      "project-resource-row project-resource-row-contract engagement-contract-row";
    row.dataset.engagementContractRow = "true";
    row.dataset.engagementId = contract.engagementId;
    row.dataset.contractState = contract.phase;

    const icon =
      template.querySelector(".project-resource-icon")?.cloneNode(true) ||
      document.createElement("span");
    icon.classList.add(
      "project-resource-icon",
      "project-resource-icon-contract"
    );
    icon.setAttribute("aria-hidden", "true");

    const copy = document.createElement("div");
    copy.className = "project-resource-copy";
    const heading = document.createElement("div");
    heading.className = "project-resource-heading";
    const label = document.createElement("h3");
    label.className = "project-resource-label";
    label.textContent = "合同";
    const count = document.createElement("span");
    count.className = "project-resource-count";
    count.textContent = total === 1 ? "1 条已关联" : `${index + 1} / ${total}`;
    heading.append(label, count);
    const name = document.createElement("strong");
    name.textContent = contract.contractName;
    const meta = document.createElement("span");
    meta.className = "project-resource-meta";
    meta.textContent = [
      contract.contractId,
      contract.creatorName,
      contract.amount,
    ]
      .filter(Boolean)
      .join(" · ");
    copy.append(heading, name, meta);

    const status = document.createElement("span");
    status.className = "project-resource-status";
    status.append(document.createElement("i"), contract.status);

    const action = document.createElement("button");
    action.type = "button";
    action.className = "text-link";
    action.dataset.linkedContractId = contract.contractId;
    action.setAttribute(
      "aria-label",
      `查看合同：${contract.contractName}`
    );
    action.textContent = "查看合同";

    row.append(icon, copy, status, action);
    return row;
  };

  const updateProjectContractProgress = (detailPage, contracts) => {
    if (!contracts.length) return;
    const progressItem = [
      ...detailPage.querySelectorAll(".project-progress-item"),
    ].find(
      (item) =>
        normalizeText(item.querySelector("strong")?.textContent) === "补充合同"
    );
    const description = progressItem?.querySelector("p");
    if (!description) return;
    const readyCount = contracts.filter(
      (contract) => contract.phase === "confirmed"
    ).length;
    const nextDescription =
      readyCount === contracts.length
        ? `已关联 ${contracts.length} 份合同，可用于请款`
        : `已关联 ${contracts.length} 份合同，${contracts.length - readyCount} 份待确认`;
    if (description.textContent !== nextDescription) {
      description.textContent = nextDescription;
    }
  };

  const renderProjectContracts = () => {
    const detailPage = document.querySelector(".project-detail-page");
    const subtitle = detailPage?.querySelector(
      ":scope > .page-heading-row p"
    )?.textContent;
    const projectId = normalizeText(subtitle).match(
      PROJECT_ID_SEARCH_PATTERN
    )?.[0];
    const resourceList = detailPage?.querySelector(".project-resource-list");
    const template = resourceList?.querySelector(
      ".project-resource-row-contract:not([data-engagement-contract-row])"
    );
    if (!detailPage || !projectId || !resourceList || !template) return;

    const contracts = listProjectContracts(projectId);
    const renderedRows = resourceList.querySelectorAll(
      "[data-engagement-contract-row]"
    );
    const signature = contracts
      .map(
        (contract) =>
          `${contract.contractId}:${contract.engagementId}:${contract.phase}`
      )
      .join("|");
    if (
      contracts.length &&
      detailPage.dataset.engagementContractSignature === signature &&
      renderedRows.length === contracts.length
    ) {
      updateProjectContractProgress(detailPage, contracts);
      return;
    }
    renderedRows.forEach((row) => row.remove());
    if (!contracts.length) {
      template.hidden = false;
      delete detailPage.dataset.engagementContractSignature;
      return;
    }

    template.hidden = true;
    const invoiceRow = resourceList.querySelector(
      ".project-resource-row-invoice"
    );
    contracts.forEach((contract, index) => {
      resourceList.insertBefore(
        createProjectContractRow(
          template,
          contract,
          index,
          contracts.length
        ),
        invoiceRow
      );
    });
    detailPage.dataset.engagementContractSignature = signature;
    updateProjectContractProgress(detailPage, contracts);
  };

  const showRelationNotice = (title, message) => {
    document.querySelector(".engagement-relation-notice")?.remove();
    window.clearTimeout(relationNoticeTimer);
    const notice = document.createElement("div");
    notice.className = "engagement-relation-notice";
    notice.setAttribute("role", "status");
    const strong = document.createElement("strong");
    strong.textContent = title;
    const span = document.createElement("span");
    span.textContent = message;
    notice.append(strong, span);
    document.body.append(notice);
    relationNoticeTimer = window.setTimeout(() => notice.remove(), 4200);
  };

  const openLinkedContract = (contractId, attempt = 0) => {
    const row = [...document.querySelectorAll(".contracts-page tbody tr")].find(
      (candidate) =>
        normalizeText(candidate.textContent).match(CONTRACT_ID_PATTERN)?.[0] ===
        contractId
    );
    if (row) {
      const action = [...row.querySelectorAll("button")].find(
        (button) => normalizeText(button.textContent) === "查看合同"
      );
      (action || row.querySelector("button"))?.click();
      return;
    }
    if (attempt < 20) {
      window.setTimeout(() => openLinkedContract(contractId, attempt + 1), 80);
      return;
    }
    showRelationNotice(
      "未找到合同记录",
      "该本地合同已不在当前页面会话中，请重新上传合同后再查看。"
    );
  };

  const fieldInputByLabel = (root, labelPrefix) =>
    [...root.querySelectorAll("label")].find((label) =>
      normalizeText(label.querySelector(":scope > span")?.textContent).startsWith(
        labelPrefix
      )
    )?.querySelector("input, textarea");

  const selectedValue = (page, ariaLabel) =>
    normalizeText(
      page.querySelector(
        `[role="combobox"][aria-label="${ariaLabel}"] .custom-select-value`
      )?.textContent
    );

  const captureInvoiceRelation = (page) => {
    const invoiceId = normalizeText(
      fieldInputByLabel(page, "Invoice 编号")?.value
    );
    const project = findProjectByName(selectedValue(page, "关联项目"));
    const creatorName = selectedValue(page, "合作达人");
    const creator =
      project && creatorName
        ? creatorForProject(project.projectId, creatorName)
        : null;
    pendingInvoiceRelation =
      invoiceId && project && creator
        ? {
            invoiceId,
            project,
            creator,
          }
        : null;
  };

  const resolvePendingInvoiceRelation = () => {
    if (!pendingInvoiceRelation) return;
    const success = document.querySelector(
      ".invoice-builder-page .invoice-generation-success"
    );
    if (
      !success ||
      !normalizeText(success.textContent).includes(
        pendingInvoiceRelation.invoiceId
      )
    ) {
      return;
    }
    const relation = recordRelation(
      "invoice",
      pendingInvoiceRelation.invoiceId,
      pendingInvoiceRelation.project,
      pendingInvoiceRelation.creator
    );
    if (relation) success.dataset.engagementId = relation.engagementId;
    pendingInvoiceRelation = null;
  };

  const decorateEntityRelations = () => {
    const store = readStore();
    document.querySelectorAll(".generated-invoice-table tbody tr").forEach((row) => {
      const invoiceId = Object.keys(store.invoices).find((id) =>
        normalizeText(row.textContent).includes(id)
      );
      if (invoiceId) {
        row.dataset.engagementId = store.invoices[invoiceId].engagementId;
      }
    });
    document.querySelectorAll(".contracts-page tbody tr").forEach((row) => {
      const contractId = normalizeText(row.textContent).match(
        CONTRACT_ID_PATTERN
      )?.[0];
      if (contractId && store.contracts[contractId]) {
        row.dataset.engagementId = store.contracts[contractId].engagementId;
      }
    });
    const contractPage = document.querySelector(".contract-detail-page");
    const contractId = normalizeText(
      contractPage?.querySelector(":scope > .page-heading-row p")?.textContent
    ).match(CONTRACT_ID_PATTERN)?.[0];
    if (contractPage && contractId && store.contracts[contractId]) {
      contractPage.dataset.engagementId =
        store.contracts[contractId].engagementId;
    }
  };

  const identifyCreator = (creator) => {
    const identity = ensureCreator(creator);
    return identity
      ? {
          id: identity.creatorId,
          creatorId: identity.creatorId,
          name: identity.creatorName,
          creatorName: identity.creatorName,
          handle: identity.handle,
        }
      : null;
  };

  const api = Object.freeze({
    ensureProject,
    identifyCreator,
    ensureEngagement,
    findProjectByName,
    getProject,
    getEngagement: (engagementId) => {
      const normalizedId = normalizeText(engagementId);
      return (
        Object.values(readStore().engagements).find(
          (engagement) => engagement.engagementId === normalizedId
        ) || null
      );
    },
    getInvoice: (invoiceId) =>
      readStore().invoices[normalizeText(invoiceId)] || null,
    getContract: (contractId) =>
      readStore().contracts[normalizeText(contractId)] || null,
    getByEngagementId: (engagementId) => {
      const normalizedId = normalizeText(engagementId);
      return (
        Object.values(readStore().engagements).find(
          (engagement) => engagement.engagementId === normalizedId
        ) || null
      );
    },
    listProjects,
    listProjectEngagements,
    listProjectContracts,
    recordInvoice: (invoiceId, project, creator) =>
      recordRelation("invoice", invoiceId, project, creator),
    recordContract: (contractId, project, creator) =>
      recordRelation("contract", contractId, project, creator),
  });

  Object.defineProperty(window, "CometsPayEngagements", {
    configurable: true,
    value: api,
  });

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("button");
      const page = button?.closest(".invoice-builder-page");
      if (
        page &&
        !button.disabled &&
        normalizeText(button.textContent) === "生成 PDF + DOCX"
      ) {
        captureInvoiceRelation(page);
      }
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("button[data-linked-contract-id]");
      if (!button) return;
      const contractId = normalizeText(button.dataset.linkedContractId);
      if (!CONTRACT_ID_PATTERN.test(contractId)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const contractsNavigation = [...document.querySelectorAll("nav button")].find(
        (candidate) =>
          normalizeText(candidate.textContent) === "合同管理"
      );
      if (!contractsNavigation) {
        showRelationNotice("无法打开合同", "请先进入合同管理后重试。");
        return;
      }
      contractsNavigation.click();
      openLinkedContract(contractId);
    },
    true
  );

  const enhance = () => {
    registerVisibleProjects();
    resolvePendingInvoiceRelation();
    decorateEntityRelations();
    renderProjectContracts();
  };

  const runEnhance = () => {
    try {
      enhance();
    } catch (error) {
      console.error("Failed to update engagement relationships.", error);
    }
  };

  document.addEventListener("comets-pay:engagement-changed", runEnhance);

  const observer = new MutationObserver(() => {
    if (observerQueued) return;
    observerQueued = true;
    queueMicrotask(() => {
      observerQueued = false;
      runEnhance();
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  runEnhance();
})();
