import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    const sw = registration.active || navigator.serviceWorker.controller;
    if (sw) sw.postMessage({ type: "SET_API_URL", url: API_URL });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
