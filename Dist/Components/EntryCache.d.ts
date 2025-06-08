export interface CachedEntry_Core {
    docId: string;
    hash: string;
    data: any;
}
interface CachedEntry extends CachedEntry_Core {
    tablePlusDocId: string;
    table: string;
}
export declare class EntryCache {
    private onInitHandlers;
    EnsureInitDone(): Promise<void>;
    private db;
    Init(): Promise<void>;
    UpdateTableEntries(table: string, entries: Array<CachedEntry_Core>): Promise<void>;
    GetCachedEntries(table: string): Promise<Record<string, CachedEntry>>;
    ClearCache(): Promise<void>;
    ClearTableCache(table: string): Promise<void>;
}
export declare const entryCache: EntryCache;
export {};
