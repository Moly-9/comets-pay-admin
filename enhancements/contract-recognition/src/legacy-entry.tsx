import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { ContractRecognitionApp } from "./App";
import "./styles.css";

const ROOT_ID = "cp-contract-recognition-root";
let reactRoot: Root | null = null;
let observedMain: HTMLElement | null = null;
let evaluationQueued = false;

const originalContractPage = (main: HTMLElement) => {
  const stacks = [...main.children].filter(
    (child) => child.id !== ROOT_ID,
  ) as HTMLElement[];
  return (
    stacks.find(
      (stack) =>
        stack.querySelector(".page-heading-row h1")?.textContent?.trim() ===
        "合同管理",
    ) ?? null
  );
};

const unmount = () => {
  reactRoot?.unmount();
  reactRoot = null;
  document.getElementById(ROOT_ID)?.remove();
  observedMain?.classList.remove("cp-contract-plugin-active");
  observedMain = null;
};

const evaluate = () => {
  evaluationQueued = false;
  const main = document.querySelector<HTMLElement>("main.main-content");
  if (!main) {
    unmount();
    return;
  }
  const originalPage = originalContractPage(main);
  if (!originalPage) {
    if (reactRoot) unmount();
    return;
  }
  if (reactRoot && observedMain === main && document.getElementById(ROOT_ID)) {
    return;
  }
  unmount();
  const canManage = [...originalPage.querySelectorAll("button")].some((button) =>
    button.textContent?.includes("上传合同"),
  );
  const container = document.createElement("div");
  container.id = ROOT_ID;
  container.className = "cr-legacy-root";
  main.appendChild(container);
  main.classList.add("cp-contract-plugin-active");
  observedMain = main;
  reactRoot = createRoot(container);
  reactRoot.render(
    <React.StrictMode>
      <ContractRecognitionApp canManage={canManage} />
    </React.StrictMode>,
  );
};

const queueEvaluation = () => {
  if (evaluationQueued) return;
  evaluationQueued = true;
  window.requestAnimationFrame(evaluate);
};

const observer = new MutationObserver(queueEvaluation);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("popstate", queueEvaluation);
queueEvaluation();
