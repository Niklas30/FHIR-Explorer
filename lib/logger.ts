export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export type LogContext = Record<string, unknown>;

type LoggerImpl = {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
  child: (context: LogContext) => LoggerImpl;
};

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const getEnv = (key: string) => {
  try {
    return process.env[key];
  } catch {
    return undefined;
  }
};

const parseLogLevel = (raw: string | undefined): LogLevel | undefined => {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "debug") return "debug";
  if (value === "info") return "info";
  if (value === "warn" || value === "warning") return "warn";
  if (value === "error") return "error";
  if (value === "silent" || value === "off" || value === "none") return "silent";
  return undefined;
};

const getConfiguredLevel = (): LogLevel => {
  const clientLevel = parseLogLevel(getEnv("NEXT_PUBLIC_LOG_LEVEL"));
  const serverLevel = parseLogLevel(getEnv("LOG_LEVEL"));
  const configured = clientLevel ?? serverLevel;
  if (configured) return configured;
  const nodeEnv = getEnv("NODE_ENV")?.toLowerCase();
  return nodeEnv === "production" ? "info" : "debug";
};

const shouldLog = (level: LogLevel) => levelRank[level] >= levelRank[getConfiguredLevel()];

const serializeError = (error: unknown, depth = 0): unknown => {
  if (depth > 3) return "[error depth limit]";
  if (!error) return error;
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: cause ? serializeError(cause, depth + 1) : undefined,
    };
  }
  if (typeof error === "object") {
    try {
      return { ...(error as Record<string, unknown>) };
    } catch {
      return String(error);
    }
  }
  return error;
};

const normalizeContext = (context: LogContext | undefined): LogContext | undefined => {
  if (!context) return undefined;
  const next: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    if (value instanceof Error) {
      next[key] = serializeError(value);
      continue;
    }
    if (key === "error" || key === "err") {
      next[key] = serializeError(value);
      continue;
    }
    next[key] = value;
  }

  return next;
};

const nowIso = () => new Date().toISOString();

const getConsoleMethod = (level: LogLevel) => {
  if (level === "error") return console.error;
  if (level === "warn") return console.warn;
  if (level === "info") return console.info;
  return console.debug;
};

const createLogger = (baseContext: LogContext): LoggerImpl => {
  const write = (level: LogLevel, message: string, context?: LogContext) => {
    if (level === "silent") return;
    if (!shouldLog(level)) return;

    const payload: LogContext = {
      ts: nowIso(),
      level,
      ...baseContext,
      ...(normalizeContext(context) ?? {}),
    };

    const method = getConsoleMethod(level);
    method.call(console, payload, message);
  };

  return {
    debug: (message, context) => write("debug", message, context),
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context),
    child: (context) => createLogger({ ...baseContext, ...(normalizeContext(context) ?? {}) }),
  };
};

export const logger: LoggerImpl = createLogger({});

