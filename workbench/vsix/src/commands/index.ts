import * as vscode from 'vscode';
import { registerScanCommands } from './scanCommands';

export function registerAllCommands(context: vscode.ExtensionContext): void {
  registerScanCommands(context);
}
