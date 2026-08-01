import path from "node:path";

import {
  NodeProgramRunner
} from "./adapters/NodeProgramRunner.js";
import {
  fileSystemEmitter
} from "./utils/FileOperations.js";

export const nodeProgramRunner =
  new NodeProgramRunner({
    fileEmitter: fileSystemEmitter
  });

/**
 * Fachada histórica del ejecutor de programas.
 */
export function launch(
  showFile,
  runningFile,
  deleFile,
  deleDir
) {
  return nodeProgramRunner.run({
    displayName: showFile,
    programPath: runningFile,
    cleanupPath: path.join(
      deleDir,
      deleFile
    )
  });
}
