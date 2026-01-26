type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLogLevel(): number {
  const env = process.env.NODE_ENV || "development";
  const configuredLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  
  if (configuredLevel && LOG_LEVELS[configuredLevel] !== undefined) {
    return LOG_LEVELS[configuredLevel];
  }
  
  return env === "production" ? LOG_LEVELS.info : LOG_LEVELS.debug;
}

function formatTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= getMinLogLevel();
}

function formatMessage(level: LogLevel, module: string, message: string): string {
  return `${formatTime()} [${level}] [${module}] ${message}`;
}

export interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

export function createLogger(module: string): Logger {
  return {
    debug: (message: string, ...args: any[]) => {
      if (shouldLog("debug")) {
        console.log(formatMessage("debug", module, message), ...args);
      }
    },
    info: (message: string, ...args: any[]) => {
      if (shouldLog("info")) {
        console.log(formatMessage("info", module, message), ...args);
      }
    },
    warn: (message: string, ...args: any[]) => {
      if (shouldLog("warn")) {
        console.warn(formatMessage("warn", module, message), ...args);
      }
    },
    error: (message: string, ...args: any[]) => {
      if (shouldLog("error")) {
        console.error(formatMessage("error", module, message), ...args);
      }
    },
  };
}

export const logger = createLogger("app");
