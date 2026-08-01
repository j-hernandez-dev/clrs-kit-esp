import {
    createCliApplication
} from "../application/composition/createCliApplication.js";

const application =
    createCliApplication();
const { exitCode } =
    await application.execute(
        process.argv.slice(2)
    );

process.exitCode = exitCode;
