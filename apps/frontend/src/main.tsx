import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";

const appTitle =
  (typeof import.meta.env.VITE_APP_TITLE === "string" && import.meta.env.VITE_APP_TITLE.trim()) ||
  "Inventario de sitios Web";
document.title = `${appTitle} · Grupo Purdy`;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
