(() => {
  "use strict";

  const DIALOG_LABEL = "上传合同";
  const CREATOR_STORE_KEY = "comets-pay.project-creators.v2";
  const PROJECT_STORE_KEY = "comets-pay.contract-upload.projects.v1";
  const PENDING_UPLOAD_KEY = "comets-pay.contract-upload.pending.v1";
  const ACCEPTED_FILE_PATTERN = /\.(pdf|doc|docx)$/i;
  const MAX_FILE_SIZE = 30 * 1024 * 1024;

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
  ].map(([id, name, brand]) => ({ id, name, brand }));

  const FIELD_DEFINITIONS = [
    {
      key: "advertiser",
      label: "Advertiser",
      aliases: ["Advertiser", "Client", "Company", "广告主", "客户", "甲方"],
    },
    {
      key: "publisher",
      label: "Publisher",
      aliases: ["Publisher", "Creator", "Influencer", "发布方", "达人", "创作者", "乙方"],
    },
    {
      key: "ioNumber",
      label: "IO编号",
      aliases: ["IO Number", "IO No.", "Insertion Order Number", "IO 编号", "订单编号"],
    },
    {
      key: "projectBrand",
      label: "项目 / 品牌",
      aliases: ["Project Name", "Campaign Name", "项目名称", "活动名称"],
      secondaryAliases: ["Brand", "品牌"],
    },
    {
      key: "platformChannel",
      label: "平台 / 频道",
      aliases: ["Platform", "Publishing Platform", "平台", "发布平台"],
      secondaryAliases: ["Channel Name", "Channel", "频道", "账号"],
    },
    {
      key: "effectiveDate",
      label: "生效日期",
      aliases: ["Effective Date", "Agreement Effective Date", "生效日期"],
    },
    {
      key: "campaignPeriod",
      label: "Campaign Period",
      aliases: ["Campaign Period", "Campaign Date", "Service Period", "活动周期", "项目周期"],
    },
    {
      key: "totalFees",
      label: "Project Total Fees",
      aliases: ["Project Total Fees", "Total Fees", "Contract Amount", "Service Fee", "项目总费用"],
    },
    {
      key: "paymentTerm",
      label: "付款期限",
      aliases: ["Payment Term", "Payment Terms", "付款期限", "付款条款"],
    },
  ];

  let activeWorkflow = null;
  let pendingCreatedProject = null;
  let observerQueued = false;

  const normalizeText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const readCreatorStore = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(CREATOR_STORE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeCreatorStore = (store) => {
    try {
      localStorage.setItem(CREATOR_STORE_KEY, JSON.stringify(store));
    } catch {
      // The current React session still remains usable without local persistence.
    }
  };

  const readProjectStore = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROJECT_STORE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeProjectStore = (projects) => {
    try {
      localStorage.setItem(PROJECT_STORE_KEY, JSON.stringify(projects));
    } catch {
      // Visible projects remain available for the current React session.
    }
  };

  const projectsPage = () =>
    [...document.querySelectorAll(".page-stack")].find(
      (page) =>
        page.querySelector(":scope > .page-heading-row h1")?.textContent?.trim() ===
        "我的项目"
    );

  const projectFromRow = (row) => {
    const cells = [...row.querySelectorAll("td")];
    const id = cells[0]?.querySelector(".cell-subtext")?.textContent?.trim();
    const name = cells[0]?.querySelector("strong")?.textContent?.trim();
    const brand = cells[1]?.textContent?.trim();
    const status = cells
      .map((cell) => normalizeText(cell.textContent))
      .find((value) =>
        ["草稿", "待启动", "进行中", "执行中", "已完成", "已暂停", "已归档"].includes(
          value
        )
      );
    if (!/^PRJ-[A-Z0-9-]+$/.test(id || "") || !name) return null;
    return { id, name, brand: brand || "待补充", status: status || "" };
  };

  const visibleProjects = () =>
    [...(projectsPage()?.querySelectorAll(".data-table tbody tr") || [])]
      .map(projectFromRow)
      .filter(Boolean);

  const persistProjects = (projects) => {
    const projectMap = new Map(
      readProjectStore().map((project) => [project.id, project])
    );
    projects.forEach((project) => {
      if (!project?.id || !project?.name) return;
      projectMap.set(project.id, {
        ...projectMap.get(project.id),
        ...project,
      });
    });
    writeProjectStore([...projectMap.values()]);
  };

  const mergeProjects = () => {
    const projectMap = new Map(BASE_PROJECTS.map((project) => [project.id, project]));
    readProjectStore().forEach((project) => {
      if (/^PRJ-[A-Z0-9-]+$/.test(project?.id || "") && project?.name) {
        projectMap.set(project.id, project);
      }
    });
    const currentProjects = visibleProjects();
    currentProjects.forEach((project) => {
      projectMap.set(project.id, {
        ...projectMap.get(project.id),
        ...project,
      });
    });
    if (currentProjects.length) persistProjects(currentProjects);
    return [...projectMap.values()];
  };

  const currentProjectContext = () => {
    const page = document.querySelector(".project-detail-page");
    const subtitle = page?.querySelector(":scope > .page-heading-row p")?.textContent || "";
    const id = subtitle.match(/PRJ-[A-Z0-9-]+/)?.[0];
    const name = page?.querySelector(":scope > .page-heading-row h1")?.textContent?.trim();
    return id && name ? { id, name } : null;
  };

  const creatorFromOption = (option) => {
    const name =
      option.querySelector(".project-creator-modal-profile strong")?.textContent?.trim() ||
      option.querySelector("strong")?.textContent?.trim() ||
      "";
    const text = normalizeText(option.textContent);
    const handle = text.match(/@[A-Za-z0-9._-]+/)?.[0] || "";
    const meta = option.querySelector(".project-creator-modal-meta")?.textContent?.trim() || "";
    return name ? { name, handle, meta } : null;
  };

  const captureProjectCreatorManager = () => {
    const dialog = document.querySelector('section[role="dialog"][aria-label="选择项目达人"]');
    const project = currentProjectContext();
    if (!dialog || !project) return;
    const selected = [...dialog.querySelectorAll('[role="option"][aria-selected="true"]')]
      .map(creatorFromOption)
      .filter(Boolean);
    const store = readCreatorStore();
    store[project.id] = {
      projectName: project.name,
      creators: selected,
      updatedAt: new Date().toISOString(),
    };
    writeCreatorStore(store);
  };

  const captureCreatorTable = () => {
    const project = currentProjectContext();
    const table = document.querySelector(".project-creator-table");
    if (!project || !table) return;
    const store = readCreatorStore();
    const existingCreators = store[project.id]?.creators || [];
    const creators = [...table.querySelectorAll("tbody tr")]
      .map((row) => {
        const primary = row.querySelector("td strong")?.textContent?.trim() || "";
        const handle = primary.startsWith("@") ? primary : "";
        const existing = existingCreators.find(
          (creator) =>
            (handle && creator.handle === handle) ||
            creator.name === primary
        );
        return existing || (primary ? { name: primary, handle, meta: "" } : null);
      })
      .filter(Boolean);
    if (!creators.length) return;
    store[project.id] = {
      projectName: project.name,
      creators,
      updatedAt: new Date().toISOString(),
    };
    writeCreatorStore(store);
  };

  const capturePendingProjectCreation = () => {
    const dialog = document.querySelector('section[role="dialog"][aria-label="新建项目"]');
    if (!dialog) return;
    const name = dialog.querySelector('[placeholder="例如：秋季新品首发"]')?.value.trim();
    if (!name) return;
    const brand = dialog.querySelector(
      '[placeholder="输入客户名称"], [placeholder="输入合作品牌"]'
    )?.value.trim();
    const creators = [...dialog.querySelectorAll('.creator-option[aria-selected="true"]')]
      .map((option) => {
        const creator = creatorFromOption(option);
        return creator;
      })
      .filter(Boolean);
    pendingCreatedProject = {
      name,
      brand: brand || "待补充",
      status: "草稿",
      creators,
    };
  };

  const resolvePendingProjectCreation = () => {
    if (!pendingCreatedProject) return;
    const row = [
      ...(projectsPage()?.querySelectorAll(".data-table tbody tr") || []),
    ].find(
      (candidate) =>
        candidate.querySelector("strong")?.textContent?.trim() === pendingCreatedProject.name
    );
    const id = row
      ?.querySelector("td:first-child .cell-subtext")
      ?.textContent?.trim();
    if (!id) return;
    const store = readCreatorStore();
    store[id] = {
      projectName: pendingCreatedProject.name,
      creators: pendingCreatedProject.creators,
      updatedAt: new Date().toISOString(),
    };
    writeCreatorStore(store);
    persistProjects([
      {
        id,
        name: pendingCreatedProject.name,
        brand: pendingCreatedProject.brand,
        status: projectFromRow(row)?.status || pendingCreatedProject.status,
      },
    ]);
    pendingCreatedProject = null;
  };

  const decodePdfString = (value) =>
    value
      .replace(/\\([()\\])/g, "$1")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\([0-7]{1,3})/g, (_, octal) =>
        String.fromCharCode(Number.parseInt(octal, 8))
      );

  const textFromPdfContent = (content) => {
    const parts = [];
    for (const match of content.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
      parts.push(decodePdfString(match[1]));
    }
    for (const match of content.matchAll(/\[((?:.|\n|\r)*?)\]\s*TJ/g)) {
      for (const literal of match[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)) {
        parts.push(decodePdfString(literal[1]));
      }
    }
    return parts.join("\n");
  };

  const inflatePdfStream = async (bytes) => {
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };

  const extractPdfText = async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const decoder = new TextDecoder("latin1");
    const source = decoder.decode(bytes);
    const textParts = [textFromPdfContent(source)];
    for (const match of source.matchAll(/stream\r?\n/g)) {
      const start = match.index + match[0].length;
      const end = source.indexOf("endstream", start);
      if (end < 0) continue;
      const dictionary = source.slice(Math.max(0, match.index - 400), match.index);
      if (!/FlateDecode/.test(dictionary)) continue;
      try {
        const inflated = await inflatePdfStream(bytes.slice(start, end));
        textParts.push(textFromPdfContent(decoder.decode(inflated)));
      } catch {
        // Some PDF streams are images, encrypted, or use unsupported filters.
      }
    }
    return textParts
      .filter(Boolean)
      .join("\n")
      .split(/\r?\n/)
      .map(normalizeText)
      .filter(Boolean)
      .join("\n");
  };

  const descendantsByLocalName = (node, localName) =>
    [...node.getElementsByTagName("*")].filter(
      (element) => element.localName === localName
    );

  const extractDocxDocumentXml = async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let endOffset = -1;
    for (
      let index = bytes.length - 22;
      index >= Math.max(0, bytes.length - 65557);
      index -= 1
    ) {
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
        if (method === 0) return decoder.decode(compressed);
        if (method !== 8) throw new Error("暂不支持该 DOCX 压缩格式");
        const stream = new Blob([compressed])
          .stream()
          .pipeThrough(new DecompressionStream("deflate-raw"));
        return decoder.decode(await new Response(stream).arrayBuffer());
      }
      directoryOffset += 46 + nameLength + extraLength + commentLength;
    }
    throw new Error("DOCX 文件缺少正文");
  };

  const extractDocxText = async (file) => {
    const xmlText = await extractDocxDocumentXml(file);
    const xml = new DOMParser().parseFromString(xmlText, "application/xml");
    if (xml.querySelector("parsererror")) throw new Error("DOCX 正文 XML 无法解析");
    return descendantsByLocalName(xml, "p")
      .map((paragraph) =>
        descendantsByLocalName(paragraph, "t")
          .map((text) => text.textContent || "")
          .join("")
      )
      .map(normalizeText)
      .filter(Boolean)
      .join("\n");
  };

  const findLabeledValue = (text, aliases) => {
    const aliasSet = new Set(aliases.map((alias) => alias.toLocaleLowerCase()));
    for (const line of text.split(/\r?\n/).map(normalizeText)) {
      const separator = line.search(/[:：]/);
      if (separator < 0) continue;
      const label = normalizeText(line.slice(0, separator)).toLocaleLowerCase();
      const value = normalizeText(line.slice(separator + 1));
      if (aliasSet.has(label) && value) return value;
    }
    return "";
  };

  const extractFields = (text, project, creator) =>
    FIELD_DEFINITIONS.map((definition) => {
      let value = findLabeledValue(text, definition.aliases);
      if (definition.secondaryAliases) {
        const secondary = findLabeledValue(text, definition.secondaryAliases);
        value = [value, secondary].filter(Boolean).join(" · ");
      }
      let source = value ? "合同文件 · 本地提取" : "未识别";
      if (definition.key === "publisher") {
        value = creator.name;
        source = "项目达人关联";
      }
      if (definition.key === "projectBrand") {
        value = [project.name, project.brand].filter(Boolean).join(" · ");
        source = "项目关联";
      }
      return {
        key: definition.key,
        label: definition.label,
        value: value || "待补充",
        source,
        status: value ? "detected" : "missing",
      };
    });

  const createModal = () => {
    const backdrop = document.createElement("div");
    backdrop.className = "cuw-backdrop";
    backdrop.innerHTML = `
      <section class="cuw-dialog" role="dialog" aria-modal="true" aria-label="${DIALOG_LABEL}">
        <header class="cuw-header">
          <div>
            <h2>上传合同</h2>
            <p>合同将先关联项目与达人，再在浏览器本地提取字段。</p>
          </div>
          <button class="cuw-close" type="button" aria-label="关闭上传合同">×</button>
        </header>
        <ol class="cuw-steps" aria-label="上传合同步骤">
          <li data-step="project"><span>1</span><em>选择项目</em></li>
          <li data-step="creator"><span>2</span><em>选择达人</em></li>
          <li data-step="file"><span>3</span><em>上传文件</em></li>
          <li data-step="review"><span>4</span><em>确认字段</em></li>
          <li data-step="save"><span>5</span><em>保存合同</em></li>
        </ol>
        <div class="cuw-body">
          <div class="cuw-field">
            <span id="cuw-project-label">选择项目</span>
            <div class="cuw-project-combobox">
              <input
                type="text"
                role="combobox"
                aria-labelledby="cuw-project-label"
                aria-label="搜索并选择合同所属项目"
                aria-expanded="false"
                aria-autocomplete="list"
                aria-controls="cuw-project-options"
                autocomplete="off"
                placeholder="输入项目名称或编号"
              >
              <button class="cuw-project-toggle" type="button" aria-label="展开项目列表"></button>
              <div id="cuw-project-options" class="cuw-project-options" role="listbox" hidden></div>
            </div>
            <small>仅展示当前系统中的项目。</small>
          </div>
          <label class="cuw-field cuw-creator-field">
            <span>选择该项目中的达人</span>
            <select aria-label="选择项目达人" disabled>
              <option value="">请先选择项目</option>
            </select>
            <small>达人名单仅来自当前项目已关联的达人档案。</small>
          </label>
          <div class="cuw-field cuw-file-field" aria-disabled="true">
            <span>上传合同文件</span>
            <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>
            <button class="cuw-file-button" type="button" disabled>选择 Word 或 PDF</button>
            <small>支持 PDF、DOC、DOCX，单个文件不超过 30 MB。</small>
          </div>
          <section class="cuw-review" aria-label="自动提取的合同字段">
            <div class="cuw-review-heading">
              <div>
                <strong>确认自动提取的合同字段</strong>
                <small>保存后仍可在合同详情逐项修改并统一确认。</small>
              </div>
              <span>等待上传</span>
            </div>
            <dl></dl>
            <button class="cuw-confirm-fields" type="button" disabled>确认字段准确</button>
          </section>
          <p class="cuw-error" role="alert" hidden></p>
        </div>
        <footer class="cuw-footer">
          <button class="cuw-cancel" type="button">取消</button>
          <button class="cuw-save" type="button" disabled>保存合同</button>
        </footer>
      </section>
    `;
    document.body.append(backdrop);
    return backdrop;
  };

  const closeWorkflow = () => {
    activeWorkflow?.backdrop.remove();
    activeWorkflow = null;
  };

  const renderStepState = () => {
    if (!activeWorkflow) return;
    const { project, creator, file, fieldsConfirmed, backdrop } = activeWorkflow;
    const states = {
      project: Boolean(project),
      creator: Boolean(creator),
      file: Boolean(file),
      review: fieldsConfirmed,
      save: fieldsConfirmed,
    };
    let currentFound = false;
    for (const step of ["project", "creator", "file", "review", "save"]) {
      const item = backdrop.querySelector(`[data-step="${step}"]`);
      item.classList.toggle("cuw-complete", states[step]);
      const isCurrent = !currentFound && !states[step];
      item.classList.toggle("cuw-current", isCurrent);
      if (isCurrent) currentFound = true;
    }
    if (!currentFound) {
      backdrop.querySelector('[data-step="save"]')?.classList.add("cuw-current");
    }
  };

  const showWorkflowError = (message = "") => {
    const error = activeWorkflow?.backdrop.querySelector(".cuw-error");
    if (!error) return;
    error.hidden = !message;
    error.textContent = message;
  };

  const resetReview = () => {
    if (!activeWorkflow) return;
    activeWorkflow.fields = [];
    activeWorkflow.fieldsConfirmed = false;
    const review = activeWorkflow.backdrop.querySelector(".cuw-review");
    review.dataset.state = "";
    review.querySelector(".cuw-review-heading > span").textContent = "等待上传";
    review.querySelector("dl").replaceChildren();
    const confirm = review.querySelector(".cuw-confirm-fields");
    confirm.disabled = true;
    confirm.textContent = "确认字段准确";
    activeWorkflow.backdrop.querySelector(".cuw-save").disabled = true;
    renderStepState();
  };

  const renderCreators = () => {
    if (!activeWorkflow) return;
    const { backdrop, project } = activeWorkflow;
    const select = backdrop.querySelector('[aria-label="选择项目达人"]');
    const helper = select.closest("label").querySelector("small");
    select.replaceChildren();
    activeWorkflow.creator = null;
    if (!project) {
      select.append(new Option("请先选择项目", ""));
      select.disabled = true;
      helper.textContent = "达人名单仅来自当前项目已关联的达人档案。";
      return;
    }
    const creators = readCreatorStore()[project.id]?.creators || [];
    if (!creators.length) {
      select.append(new Option("当前项目尚未关联具体达人", ""));
      select.disabled = true;
      helper.textContent = "请先在项目详情的“达人名单”中关联具体达人档案。";
      return;
    }
    select.append(new Option("请选择达人", ""));
    creators.forEach((creator, index) => {
      const creatorLabel =
        creator.handle && creator.handle !== creator.name
          ? `${creator.name} · ${creator.handle}`
          : creator.name;
      const option = new Option(
        creatorLabel,
        String(index)
      );
      option.dataset.creator = JSON.stringify(creator);
      select.append(option);
    });
    select.disabled = false;
    helper.textContent = `仅显示当前项目已关联的 ${creators.length} 位达人。`;
  };

  const renderFields = () => {
    if (!activeWorkflow) return;
    const review = activeWorkflow.backdrop.querySelector(".cuw-review");
    const list = review.querySelector("dl");
    list.replaceChildren();
    activeWorkflow.fields.forEach((field) => {
      const row = document.createElement("div");
      row.className = field.status === "missing" ? "cuw-field-missing" : "";
      row.innerHTML = `
        <dt>${escapeHtml(field.label)}</dt>
        <dd>
          <strong>${escapeHtml(field.value)}</strong>
          <small>${escapeHtml(field.source)}</small>
        </dd>
      `;
      list.append(row);
    });
  };

  const parseSelectedFile = async () => {
    if (!activeWorkflow?.file) return;
    const { file, backdrop, project, creator } = activeWorkflow;
    const review = backdrop.querySelector(".cuw-review");
    const state = review.querySelector(".cuw-review-heading > span");
    const confirm = review.querySelector(".cuw-confirm-fields");
    review.dataset.state = "parsing";
    state.textContent = "本地解析中";
    confirm.disabled = true;
    showWorkflowError();
    try {
      let documentText = "";
      if (/\.docx$/i.test(file.name)) documentText = await extractDocxText(file);
      if (/\.pdf$/i.test(file.name)) documentText = await extractPdfText(file);
      activeWorkflow.fields = extractFields(documentText, project, creator);
      activeWorkflow.fieldsConfirmed = false;
      review.dataset.state = "ready";
      state.textContent = documentText ? "提取完成" : "部分提取";
      confirm.disabled = false;
      renderFields();
      renderStepState();
    } catch (error) {
      activeWorkflow.fields = extractFields("", project, creator);
      review.dataset.state = "ready";
      state.textContent = "部分提取";
      confirm.disabled = false;
      renderFields();
      showWorkflowError(
        `${error?.message || "文件正文无法解析"}。项目与达人信息已保留，其余字段可在合同详情补充。`
      );
      renderStepState();
    }
  };

  const validateFile = (file) => {
    if (!file) return "请选择合同文件。";
    if (!ACCEPTED_FILE_PATTERN.test(file.name)) return "仅支持 PDF、DOC 或 DOCX 文件。";
    if (!file.size) return "不能上传空文件。";
    if (file.size > MAX_FILE_SIZE) return "文件大小不能超过 30 MB。";
    return "";
  };

  const saveContract = () => {
    if (!activeWorkflow?.fieldsConfirmed) return;
    const nativeInput = document.querySelector(
      '.contracts-page input.sr-only[type="file"]'
    );
    if (!nativeInput) {
      showWorkflowError("未找到原有合同上传入口，请关闭后重试。");
      return;
    }
    const { project, creator, file, fields } = activeWorkflow;
    const pendingContext = {
      version: 1,
      fileName: file.name,
      project,
      creator,
      fields: Object.fromEntries(
        fields
          .filter((field) => field.status !== "missing")
          .map((field) => [
            field.key,
            {
              value: field.value,
              source: field.source,
              status: "detected",
            },
          ])
      ),
      confirmedAt: new Date().toISOString(),
    };
    try {
      sessionStorage.setItem(PENDING_UPLOAD_KEY, JSON.stringify(pendingContext));
    } catch {
      // The upload still proceeds; only the association handoff may be unavailable.
    }
    const transfer = new DataTransfer();
    transfer.items.add(file);
    closeWorkflow();
    nativeInput.files = transfer.files;
    nativeInput.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const openWorkflow = () => {
    if (activeWorkflow) return;
    const backdrop = createModal();
    const projects = mergeProjects();
    const projectInput = backdrop.querySelector(
      '[aria-label="搜索并选择合同所属项目"]'
    );
    const projectOptions = backdrop.querySelector(".cuw-project-options");
    const projectToggle = backdrop.querySelector(".cuw-project-toggle");
    const sourceChevron = document.querySelector(".custom-select-chevron");
    if (sourceChevron) projectToggle.append(sourceChevron.cloneNode(true));
    else projectToggle.textContent = "展开";
    activeWorkflow = {
      backdrop,
      project: null,
      creator: null,
      file: null,
      fields: [],
      fieldsConfirmed: false,
    };

    const creatorSelect = backdrop.querySelector('[aria-label="选择项目达人"]');
    const fileInput = backdrop.querySelector('input[type="file"]');
    const fileButton = backdrop.querySelector(".cuw-file-button");
    const fileField = backdrop.querySelector(".cuw-file-field");
    const confirmFields = backdrop.querySelector(".cuw-confirm-fields");

    let filteredProjects = projects;
    let highlightedProjectIndex = -1;

    const resetProjectDependents = () => {
      activeWorkflow.file = null;
      fileInput.value = "";
      fileButton.textContent = "选择 Word 或 PDF";
      fileButton.disabled = true;
      fileField.setAttribute("aria-disabled", "true");
      renderCreators();
      resetReview();
      showWorkflowError();
    };

    const closeProjectOptions = () => {
      projectOptions.hidden = true;
      projectInput.setAttribute("aria-expanded", "false");
      projectInput.removeAttribute("aria-activedescendant");
      highlightedProjectIndex = -1;
    };

    const highlightProject = (index) => {
      const options = [...projectOptions.querySelectorAll('[role="option"]')];
      if (!options.length) return;
      highlightedProjectIndex = (index + options.length) % options.length;
      options.forEach((option, optionIndex) => {
        const highlighted = optionIndex === highlightedProjectIndex;
        option.classList.toggle("cuw-project-option-active", highlighted);
        option.setAttribute("aria-selected", highlighted ? "true" : "false");
      });
      const activeOption = options[highlightedProjectIndex];
      projectInput.setAttribute("aria-activedescendant", activeOption.id);
      activeOption.scrollIntoView({ block: "nearest" });
    };

    const selectProject = (project) => {
      activeWorkflow.project = project;
      projectInput.value = project.name;
      closeProjectOptions();
      resetProjectDependents();
    };

    const renderProjectOptions = (query = "") => {
      const normalizedQuery = normalizeText(query).toLocaleLowerCase();
      filteredProjects = projects.filter((project) =>
        [project.name, project.id, project.brand, project.status]
          .filter(Boolean)
          .some((value) =>
            String(value).toLocaleLowerCase().includes(normalizedQuery)
          )
      );
      projectOptions.replaceChildren();
      if (!filteredProjects.length) {
        const empty = document.createElement("p");
        empty.className = "cuw-project-empty";
        empty.textContent = "没有匹配的项目";
        projectOptions.append(empty);
      } else {
        filteredProjects.forEach((project, index) => {
          const option = document.createElement("button");
          option.type = "button";
          option.id = `cuw-project-option-${index}`;
          option.className = "cuw-project-option";
          option.setAttribute("role", "option");
          option.setAttribute("aria-selected", "false");
          option.innerHTML = `
            <span class="cuw-project-option-main">
              <strong>${escapeHtml(project.name)}</strong>
              ${
                project.status
                  ? `<em data-status="${escapeHtml(project.status)}">${escapeHtml(project.status)}</em>`
                  : ""
              }
            </span>
            <small>${escapeHtml(project.brand || "待补充")}</small>
          `;
          option.addEventListener("mousedown", (event) => event.preventDefault());
          option.addEventListener("click", () => selectProject(project));
          projectOptions.append(option);
        });
      }
      projectOptions.hidden = false;
      projectInput.setAttribute("aria-expanded", "true");
      highlightedProjectIndex = -1;
    };

    projectInput.addEventListener("focus", () => {
      renderProjectOptions(
        activeWorkflow.project && projectInput.value === activeWorkflow.project.name
          ? ""
          : projectInput.value
      );
    });
    projectInput.addEventListener("input", () => {
      if (
        activeWorkflow.project &&
        projectInput.value !== activeWorkflow.project.name
      ) {
        activeWorkflow.project = null;
        resetProjectDependents();
      }
      renderProjectOptions(projectInput.value);
    });
    projectInput.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (projectOptions.hidden) renderProjectOptions(projectInput.value);
        highlightProject(
          highlightedProjectIndex + (event.key === "ArrowDown" ? 1 : -1)
        );
      } else if (event.key === "Enter" && highlightedProjectIndex >= 0) {
        event.preventDefault();
        selectProject(filteredProjects[highlightedProjectIndex]);
      } else if (event.key === "Escape") {
        event.stopPropagation();
        closeProjectOptions();
      }
    });
    projectToggle.addEventListener("click", () => {
      if (projectOptions.hidden) {
        projectInput.focus();
        renderProjectOptions("");
      } else {
        closeProjectOptions();
        projectInput.focus();
      }
    });
    backdrop.addEventListener("mousedown", (event) => {
      if (!event.target.closest(".cuw-project-combobox")) closeProjectOptions();
    });

    creatorSelect.addEventListener("change", () => {
      const selected = creatorSelect.selectedOptions[0];
      activeWorkflow.creator = selected?.dataset.creator
        ? JSON.parse(selected.dataset.creator)
        : null;
      activeWorkflow.file = null;
      fileInput.value = "";
      fileButton.textContent = "选择 Word 或 PDF";
      fileButton.disabled = !activeWorkflow.creator;
      fileField.setAttribute(
        "aria-disabled",
        activeWorkflow.creator ? "false" : "true"
      );
      resetReview();
      showWorkflowError();
    });

    fileButton.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      const error = validateFile(file);
      if (error) {
        activeWorkflow.file = null;
        fileButton.textContent = "选择 Word 或 PDF";
        showWorkflowError(error);
        resetReview();
        return;
      }
      activeWorkflow.file = file;
      fileButton.textContent = file.name;
      resetReview();
      void parseSelectedFile();
    });

    confirmFields.addEventListener("click", () => {
      activeWorkflow.fieldsConfirmed = true;
      confirmFields.disabled = true;
      confirmFields.textContent = "已确认字段";
      backdrop.querySelector(".cuw-review").dataset.state = "confirmed";
      backdrop.querySelector(".cuw-save").disabled = false;
      showWorkflowError();
      renderStepState();
    });

    backdrop.querySelector(".cuw-save").addEventListener("click", saveContract);
    backdrop.querySelector(".cuw-cancel").addEventListener("click", closeWorkflow);
    backdrop.querySelector(".cuw-close").addEventListener("click", closeWorkflow);
    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) closeWorkflow();
    });
    renderStepState();
    projectInput.focus();
  };

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("button");
      const buttonText = button?.textContent?.trim() || "";
      if (
        button &&
        buttonText === "上传合同" &&
        button.closest(".contracts-page")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openWorkflow();
        return;
      }
      if (buttonText.startsWith("保存名单（")) {
        captureProjectCreatorManager();
      }
      if (buttonText === "创建项目") {
        capturePendingProjectCreation();
      }
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeWorkflow) closeWorkflow();
  });

  const enhance = () => {
    const currentProjects = visibleProjects();
    if (currentProjects.length) persistProjects(currentProjects);
    captureCreatorTable();
    resolvePendingProjectCreation();
  };

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
