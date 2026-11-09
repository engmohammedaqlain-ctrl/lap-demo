import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./mobile/mobile.css";
import "./ui/stage.css";
import { initDevice } from "./mobile/device.js";
import { armOnFirstGesture } from "./audio/sfx.js";

initDevice();
armOnFirstGesture();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
