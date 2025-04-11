import * as vscode from "vscode";
import { FactoryLinkProvider } from "./providers/factoryLinkProvider";

export function activate(context: vscode.ExtensionContext) {
  const provider = new FactoryLinkProvider();
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(
      { scheme: "file", language: "ruby" },
      provider
    )
  );

  // Register command to jump to specific line
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "rails-factorybot-jump.gotoLine",
      async (args: { uri: string; lineNumber: number }) => {
        const uri = vscode.Uri.parse(args.uri);
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);
        const position = new vscode.Position(args.lineNumber, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));
      }
    )
  );

  // Watch for file changes to update cache
  const watcher = vscode.workspace.createFileSystemWatcher(
    "**/factories/**/*.rb"
  );
  watcher.onDidChange(async () => {
    await provider.initializeFactoryFiles();
  });
  watcher.onDidCreate(async () => {
    await provider.initializeFactoryFiles();
  });
  watcher.onDidDelete(async () => {
    await provider.initializeFactoryFiles();
  });
  context.subscriptions.push(watcher);
}

export function deactivate() {}
