export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVELS: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

const currentLogLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'INFO';

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
}

const logger = {
    debug: (message: string, ...args: any[]) => {
        if (shouldLog('DEBUG')) {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    },
    info: (message: string, ...args: any[]) => {
        if (shouldLog('INFO')) {
            console.info(`[INFO] ${message}`, ...args);
        }
    },
    warn: (message: string, ...args: any[]) => {
        if (shouldLog('WARN')) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    },
    error: (message: string, ...args: any[]) => {
        if (shouldLog('ERROR')) {
            console.error(`[ERROR] ${message}`, ...args);
        }
    },
};

// Log startup message only once on the server side
if (typeof window === 'undefined') {
    // Use a global variable to prevent multiple logs in development due to hot reloading or multiple imports
    const globalAny: any = global;
    if (!globalAny._loggerInitialized) {
        console.log(`[SYSTEM] Application started. Log level: ${currentLogLevel}`);
        globalAny._loggerInitialized = true;
    }
}

export default logger;
