export class EntryCache {
    constructor() {
        this.onInitHandlers = [];
    }
    EnsureInitDone() {
        return new Promise((resolve, reject) => {
            if (this.db)
                resolve();
            else
                this.onInitHandlers.push(resolve);
        });
    }
    async Init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("MGL_EntryCache", 2);
            request.onupgradeneeded = event => {
                const db = event.target.result;
                const store = db.createObjectStore("entries", { keyPath: "tablePlusDocId" });
                store.createIndex("table", "table", { unique: false });
            };
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                this.onInitHandlers.forEach(handler => handler());
                resolve();
            };
        });
    }
    // Update cache with new/changed entries
    async UpdateTableEntries(table, entries) {
        await this.EnsureInitDone();
        const transaction = this.db.transaction(["entries"], "readwrite");
        const store = transaction.objectStore("entries");
        const promises = entries.map(entry => {
            const cachedEntry = {
                tablePlusDocId: `${table}:${entry.docId}`,
                table,
                ...entry,
            };
            return new Promise((resolve, reject) => {
                const request = store.put(cachedEntry);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        });
        await Promise.all(promises);
    }
    // get all cached-entries for a table (for local use)
    async GetCachedEntries(table) {
        await this.EnsureInitDone();
        const transaction = this.db.transaction(["entries"], "readonly");
        const store = transaction.objectStore("entries");
        const index = store.index("table");
        return new Promise((resolve, reject) => {
            const entries = {};
            const request = index.openCursor(IDBKeyRange.only(table));
            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    const cachedEntry = cursor.value;
                    const [_table, entryId] = cachedEntry.tablePlusDocId.split(":");
                    entries[entryId] = cachedEntry;
                    cursor.continue();
                }
                else {
                    resolve(entries);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
    // get all cached hashes for a table, in the form of a map (entryId->hash) [eg. for sending to graphlink server]
    /*async GetCachedEntryHashes(table: string): Promise<Record<string, string>> {
        await this.EnsureInitDone();
        const transaction = this.db.transaction(["entries"], "readonly");
        const store = transaction.objectStore("entries");
        const index = store.index("table");

        return new Promise((resolve, reject)=>{
            const entries = {} as Record<string, string>;
            const request = index.openCursor(IDBKeyRange.only(table));
            request.onsuccess = event=>{
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                    const cachedEntry = cursor.value as CachedEntry;
                    const [_table, entryId] = cachedEntry.id.split(":");
                    //entries[entryId] = CE(cachedEntry).ExcludeKeys("table") as CachedEntry_Core;
                    entries[entryId] = cachedEntry.hash;
                    cursor.continue();
                } else {
                    resolve(entries);
                }
            };
            request.onerror = ()=>reject(request.error);
        });
    }*/
    // Clear all cache (for manual clearing)
    async ClearCache() {
        await this.EnsureInitDone();
        const transaction = this.db.transaction(["entries"], "readwrite");
        const store = transaction.objectStore("entries");
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    // Clear cache for specific table
    async ClearTableCache(table) {
        await this.EnsureInitDone();
        const transaction = this.db.transaction(["entries"], "readwrite");
        const store = transaction.objectStore("entries");
        const index = store.index("table");
        return new Promise((resolve, reject) => {
            const request = index.openCursor(IDBKeyRange.only(table));
            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
                else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
}
export const entryCache = new EntryCache();
entryCache.Init(); // this is async, but that's fine; if a method is called prior to class init, it will just wait for initialization to complete before proceeding
