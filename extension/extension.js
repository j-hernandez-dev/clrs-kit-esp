import { registerCodeCommands } from './commands/CodeCommands.js';
import { registerDiagramCommands } from './commands/DiagramCommands.js';

/**
 * @param {vscode.ExtensionContext} context
 */
export function activate(context) {
    console.log('CLRS Kit actived successfully');

    registerCodeCommands(context);
    registerDiagramCommands(context);
}

export function deactivate() { }