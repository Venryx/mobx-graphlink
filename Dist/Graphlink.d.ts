import { TreeNode } from "./Tree/TreeNode.js";
import { TreeRequestWatcher } from "./Tree/TreeRequestWatcher.js";
import { ApolloClient, NormalizedCacheObject } from "@apollo/client/core/index.js";
import type { PoolClient } from "pg";
import type Knex from "knex";
import { AccessorMetadata } from "./Accessors/@AccessorMetadata.js";
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
    pgClient?: PoolClient;
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
        pgClient?: PoolClient | null | undefined;
    };
    userInfo: UserInfo | null;
    tree: TreeNode<DBShape>;
    treeRequestWatchers: Set<TreeRequestWatcher>;
    UnsubscribeAll(): void;
    ValidateDBData?: (dbData: DBShape) => void;
}
export declare class UserInfo {
    id: string;
}
