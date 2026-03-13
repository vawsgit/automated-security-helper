import { useEffect } from 'react';
import type { WebviewToExtMessage, ExtToWebviewMessage } from '../types/messages';

interface VSCodeAPI {
  postMessage(message: WebviewToExtMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeAPI;

const vscode = acquireVsCodeApi();

export function postMessage(message: WebviewToExtMessage): void {
  vscode.postMessage(message);
}

export function useMessages(handler: (msg: ExtToWebviewMessage) => void): void {
  useEffect(() => {
    const listener = (event: MessageEvent<ExtToWebviewMessage>) => handler(event.data);
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [handler]);
}
