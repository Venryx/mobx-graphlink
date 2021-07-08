export declare function Log(...args: any[]): void;
export declare class LogTypes_Base {
    dbRequests: boolean;
    dbRequests_onlyFirst: boolean;
    cacheUpdates: boolean;
    commands: boolean;
    subscriptions: boolean;
}
export declare function ShouldLog_Base<LogTypes extends LogTypes_Base>(shouldLogFunc: (logTypes: LogTypes) => boolean): boolean;
export declare function MaybeLog_Base<LogTypes extends LogTypes_Base>(shouldLogFunc: (logTypes: LogTypes) => boolean, loggerFunc: (() => string) | ((Log: Function) => any)): void;
export declare function JSONStringify_NoQuotesForKeys(obj: Object): string;
