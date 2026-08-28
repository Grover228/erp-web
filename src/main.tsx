import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById("app-splash");
    splash?.classList.add("app-splash--hide");
    window.setTimeout(() => splash?.remove(), 260);
  });
});
