import React from "react";
import { createRoot } from "react-dom/client";
import { PayoutAccountActions } from "./PayoutAccountActions";
import "./styles.css";

const ROOT_ID = "cp-payout-account-actions-root";
let container = document.getElementById(ROOT_ID);

if (!container) {
  container = document.createElement("div");
  container.id = ROOT_ID;
  document.body.appendChild(container);
}

createRoot(container).render(
  <React.StrictMode>
    <PayoutAccountActions />
  </React.StrictMode>,
);
