import React from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  ContractRecognitionApp,
  OPEN_CONTRACT_UPLOAD_EVENT,
} from "./App";
import "./styles.css";

const ROOT_ID = "cp-contract-recognition-root";
let reactRoot: Root | null = null;

const syncMainBounds = () => {
  const main = document.querySelector<HTMLElement>("main.main-content");
  const root = document.getElementById(ROOT_ID);
  if (!main || !root) return;
  const bounds = main.getBoundingClientRect();
  const bannerBottom =
    document.querySelector<HTMLElement>("header")?.getBoundingClientRect()
      .bottom ?? 0;
  root.style.setProperty("--cr-main-left", `${bounds.left}px`);
  root.style.setProperty(
    "--cr-main-top",
    `${Math.max(bounds.top, bannerBottom)}px`,
  );
  root.style.setProperty("--cr-main-width", `${bounds.width}px`);
};

const isContractPage = () =>
  [...document.querySelectorAll<HTMLElement>(".page-heading-row h1")].some(
    (heading) => heading.textContent?.trim() === "合同管理",
  );

const isUploadContractButton = (target: EventTarget | null) => {
  const button =
    target instanceof Element ? target.closest<HTMLButtonElement>("button") : null;
  return Boolean(
    button &&
      isContractPage() &&
      button.textContent?.replace(/\s+/g, "").includes("上传合同"),
  );
};

const mount = () => {
  if (reactRoot) return;
  const container = document.createElement("div");
  container.id = ROOT_ID;
  container.className = "cr-legacy-root";
  document.body.appendChild(container);
  reactRoot = createRoot(container);
  reactRoot.render(
    <React.StrictMode>
      <ContractRecognitionApp />
    </React.StrictMode>,
  );
  syncMainBounds();
};

document.addEventListener(
  "click",
  (event) => {
    if (!isUploadContractButton(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    mount();
    syncMainBounds();
    window.dispatchEvent(new CustomEvent(OPEN_CONTRACT_UPLOAD_EVENT));
  },
  true,
);

mount();
window.addEventListener("resize", syncMainBounds);
