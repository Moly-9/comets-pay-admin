import React from "react";
import ReactDOM from "react-dom/client";
import { ContractRecognitionApp } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <main className="cr-dev-shell">
      <ContractRecognitionApp initialOpen />
    </main>
  </React.StrictMode>,
);
