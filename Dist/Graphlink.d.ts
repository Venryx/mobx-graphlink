import { TreeNode } from "./Tree/TreeNode.js";
import { TreeRequestWatcher } from "./Tree/TreeRequestWatcher.js";
import type { Pool } from "pg";
import type Knex from "knex";
import { AccessorMetadata } from "./Accessors/@AccessorMetadata.js";
import { ApolloClient, NormalizedCacheObject } from "./Utils/@NPMFixes/apollo_client.js";
export declare let defaultGraphOptions: GraphOptions;
export declare function SetDefaultGraphOptions(opt: GraphOptions): void;
export interface GraphOptions<StoreShape = any, DBShape = any> {
    graph: Graphlink<StoreShape, DBShape>;
}
export declare class GraphlinkInitOptions<StoreShape> {
    rootStore: StoreShape;
    apollo: ApolloClient<NormalizedCacheObject>;
    onServer: boolean;
    knexModule?: typeof Knex;
    pgPool?: Pool;
}
export declare class Graphlink<StoreShape, DBShape> {
    static instances: Graphlink<any, any>[];
    constructor(initOptions?: GraphlinkInitOptions<StoreShape>);
    initialized: boolean;
    Initialize(initOptions: GraphlinkInitOptions<StoreShape>): void;
    rootStore: StoreShape;
    storeOverridesStack: StoreShape[];
    storeAccessorCachingTempDisabled: boolean;
    lastRunAccessor_meta: AccessorMetadata | undefined;
    onServer: boolean;
    subs: {
        apollo: ApolloClient<NormalizedCacheObject>;
        knexModule?: typeof Knex | null | undefined;
        pgPool?: Pool | null | undefined;
    };
    readonly userInfo: UserInfo | null;
    SetUserInfo(userInfo: UserInfo, clearCaches?: boolean): Promise<void> | undefined;
    tree: TreeNode<DBShape>;
    treeRequestWatchers: Set<TreeRequestWatcher>;
    UnsubscribeAll(): void;
    ValidateDBData?: (dbData: DBShape) => void;
}
export declare class UserInfo {
    id: string;
}
