import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import {
    createWebviewApplication
} from "./composition/createWebviewApplication.js";

import "./style.css";


const application =
    createWebviewApplication();

ReactDOM.createRoot(
    document.getElementById("app")
).render(
    <React.StrictMode>
        <App
            application={application}
        />
    </React.StrictMode>
);
