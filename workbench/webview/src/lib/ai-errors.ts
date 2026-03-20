const errorMessages: Record<string, string> = {
  credentials_missing: 'No API credentials found. Configure your AI provider in Settings.',
  auth_failed: 'Authentication failed. Check your API key or AWS credentials.',
  model_unavailable: 'Model not available. Check your region and model settings.',
  network_error: 'Network error. Check your internet connection and try again.',
  budget_exceeded: 'Analysis budget exceeded.',
  max_turns_exceeded: 'Analysis reached maximum turns limit.',
  format_error: 'AI response could not be parsed. Try again.',
  cancelled: 'Analysis cancelled.',
  unknown: 'An unexpected error occurred. Check the ASH output channel for details.',
};

export function getAiErrorMessage(errorType: string): string {
  return errorMessages[errorType] ?? errorMessages.unknown;
}
