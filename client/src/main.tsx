import { createRoot } from "react-dom/client";
import { setupIonicReact } from "@ionic/react";
import App from "./App";

import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";

import "./index.css";

setupIonicReact({
  mode: "ios",
});

createRoot(document.getElementById("root")!).render(<App />);
