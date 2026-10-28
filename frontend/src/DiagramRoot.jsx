import App from "./App.jsx";
import {
    createWebviewApplication
} from "./composition/createWebviewApplication.js";

const application =
    createWebviewApplication();

export default function DiagramRoot() {
    return (
        <App application={application} />
    );
}
