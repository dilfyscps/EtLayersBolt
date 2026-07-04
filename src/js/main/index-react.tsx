import React from "react";
import ReactDOM from "react-dom/client";
import { initBolt } from "../lib/utils/bolt";
import { App } from "./App";
import {
  reportStartupFatal,
  recordStartupStage,
  StartupDiagnosticError,
  type StartupDiagnosticDetails,
  toStartupDiagnosticDetails,
} from "./lib/startupDiagnostics";
import "./etlayers-native.css";

initBolt();

function StartupFatalPanel({ details }: { details: StartupDiagnosticDetails }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        padding: 20,
        background: "linear-gradient(180deg, #151520 0%, #0d0d14 100%)",
        color: "#f4f2f8",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <section
        style={{
          border: "1px solid rgba(255, 101, 104, 0.35)",
          borderRadius: 16,
          background: "rgba(17, 17, 25, 0.96)",
          padding: 18,
        }}
      >
        <p style={{ margin: "0 0 6px", color: "#ff9a9c", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          EtLayers Fatal Startup Error
        </p>
        <h1 style={{ margin: 0, color: "#fff", fontSize: 20 }}>Startup failed</h1>
        <p style={{ margin: "12px 0 0", fontSize: 12, lineHeight: 1.55 }}>
          Stage: {details.stage}
        </p>
        <pre
          style={{
            margin: "12px 0 0",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            background: "rgba(7, 8, 13, 0.78)",
            padding: 10,
            color: "#d8d4e4",
            fontSize: 10,
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
            userSelect: "text",
          }}
        >
          {JSON.stringify(details, null, 2)}
        </pre>
      </section>
    </main>
  );
}

class StartupErrorBoundary extends React.Component<React.PropsWithChildren, { details: StartupDiagnosticDetails | null }> {
  state = { details: null };

  static getDerivedStateFromError(error: unknown) {
    return {
      details: toStartupDiagnosticDetails(error, "Rendering React UI."),
    };
  }

  componentDidCatch(error: unknown) {
    reportStartupFatal(toStartupDiagnosticDetails(error, "Rendering React UI."));
  }

  render() {
    if (this.state.details) {
      return <StartupFatalPanel details={this.state.details} />;
    }

    return this.props.children;
  }
}

try {
  window.__ETLAYERS_REACT_STARTED__ = true;
  recordStartupStage("Starting React...");

  const rootElement = document.getElementById("app");

  if (!rootElement) {
    throw new StartupDiagnosticError({
      stage: "Starting React...",
      message: "Missing #app element in index.html.",
      file: "src/js/main/index.html",
    });
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <StartupErrorBoundary>
        <App />
      </StartupErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  const details = toStartupDiagnosticDetails(error, "Starting React...");
  reportStartupFatal(details);
}
