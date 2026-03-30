import "@ant-design/v5-patch-for-react-19";
import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./i18n";

const normalizedHostname = window.location.hostname.replace(/^\[|\]$/g, "");
const shouldBypassLocalPwaCache =
  normalizedHostname === "localhost" ||
  normalizedHostname === "::1" ||
  /^127(?:\.\d{1,3}){3}$/.test(normalizedHostname);

if (shouldBypassLocalPwaCache) {
  // Local PR validation should always reflect the newest bundle; clear service workers and
  // their caches on localhost-style hosts to prevent stale UI from older test builds.
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister();
      });
    });
  }
  if ("caches" in window) {
    void caches.keys().then((keys) => {
      keys.forEach((key) => {
        void caches.delete(key);
      });
    });
  }
}

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <React.Suspense fallback="loading">
      <App />
    </React.Suspense>
  </React.StrictMode>,
);
