export enum ProviderErrorCategory {
  AUTH = 'AUTH',
  QUOTA = 'QUOTA',
  NETWORK = 'NETWORK',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNKNOWN = 'UNKNOWN',
}

export interface ProviderDiagnostic {
  provider: string;
  model: string;
  latencyMs: number;
  httpStatus?: number | string;
  providerErrorCode?: string;
  providerErrorType?: string;
  errorCategory?: ProviderErrorCategory;
  errorMessage?: string; // Always stripped of API keys
  requestId?: string;
  cooldownUntil?: number;
  fallbackUsed?: boolean;
}

export interface ProviderCapabilities {
  textGeneration: boolean;
  toolCalling: boolean;
  structuredOutput: boolean;
  streaming: boolean;
  vision: boolean;
}

export interface MultiProviderConfig {
  primaryProvider: string;
  fallbackOrder: string[];
}

export class ProviderError extends Error {
  public providerErrorCode?: string;
  public providerErrorType?: string;
  public httpStatus?: number;

  constructor(
    public category: ProviderErrorCategory, 
    message: string, 
    httpStatus?: number,
    providerErrorCode?: string,
    providerErrorType?: string
  ) {
    super(message);
    this.name = 'ProviderError';
    this.httpStatus = httpStatus;
    this.providerErrorCode = providerErrorCode;
    this.providerErrorType = providerErrorType;
  }
}

export function normalizeAIError(
  status: number | undefined, 
  message: string, 
  originalError?: any,
  providerErrorCode?: string,
  providerErrorType?: string
): ProviderError {
  let category = ProviderErrorCategory.UNKNOWN;

  if (status) {
    if (status === 400 || status === 422) {
      category = ProviderErrorCategory.INVALID_REQUEST;
    } else if (status === 401) {
      category = ProviderErrorCategory.AUTH;
    } else if (status === 403) {
      category = ProviderErrorCategory.AUTH;
    } else if (status === 404) {
      // 404 is usually model not found, but can be invalid request route
      category = ProviderErrorCategory.MODEL_NOT_FOUND;
    } else if (status === 408) {
      category = ProviderErrorCategory.NETWORK;
    } else if (status === 429) {
      category = ProviderErrorCategory.QUOTA;
    } else if (status >= 500) {
      category = ProviderErrorCategory.NETWORK;
    }
  } else if (originalError) {
    const errStr = String(originalError).toLowerCase();
    if (errStr.includes('abort') || errStr.includes('timeout') || errStr.includes('network') || errStr.includes('econnrefused') || errStr.includes('fetch failed')) {
      category = ProviderErrorCategory.NETWORK;
    }
  }

  // Sanitize message: never expose keys
  let safeMessage = message;
  const envKeys = [
    process.env.GEMINI_API_KEY,
    process.env.OPENROUTER_API_KEY,
    process.env.GROQ_API_KEY,
    process.env.AI_API_KEY
  ].filter(Boolean) as string[];
  
  for (const key of envKeys) {
    if (key && key.length > 5) {
      safeMessage = safeMessage.replace(new RegExp(key, 'g'), '[REDACTED_KEY]');
    }
  }

  return new ProviderError(category, safeMessage, status, providerErrorCode, providerErrorType);
}
