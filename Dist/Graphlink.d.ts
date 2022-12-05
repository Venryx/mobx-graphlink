import { TreeNode } from "./Tree/TreeNode.js";
import { TreeRequestWatcher } from "./Tree/TreeRequestWatcher.js";
import type Knex from "knex";
import { ApolloClient, NormalizedCacheObject } from "./Utils/@NPMFixes/apollo_client.js";
import { AccessorCallPlan } from "./Accessors/@AccessorCallPlan.js";
export declare let defaultGraphOptions: GraphOptions;
export declare function SetDefaultGraphOptions(opt: GraphOptions): void;
export interface GraphOptions<StoreShape = any, DBShape = any> {
    graph: Graphlink<StoreShape, DBShape>;
}
export declare class GraphlinkInitOptions<StoreShape> {
    rootStore: StoreShape;
    apollo: ApolloClient<NormalizedCacheObject>;
    onServer: boolean;
    /**
     * After X milliseconds of being unobserved, a TreeNode will unsubscribe its GraphQL subscription, by sending "stop" over the websocket.
     * Special values: 5000 (default), -1 (never auto-unsubscribe)
     * */
    unsubscribeTreeNodesAfter?: number;
    knexModule?: typeof Knex;
    pgPool?: any;
}
export declare class Graphlink<StoreShape, DBShape> {
    static instances: Graphlink<any, any>[];
    constructor(initOptions?: GraphlinkInitOptions<StoreShape>);
    initialized: boolean;
    Initialize(initOptions: GraphlinkInitOptions<StoreShape>): void;
    rootStore: StoreShape;
    storeOverridesStack: StoreShape[];
    /** Set this to false if you need to make sure all relevant database-requests within an accessor tree are being activated. */
    storeAccessorCachingTempDisabled: boolean;
    callPlan_callStack: AccessorCallPlan[];
    GetDeepestCallPlanCurrentlyRunning(): AccessorCallPlan;
    onServer: boolean;
    subs: {
        apollo: ApolloClient<NormalizedCacheObject>;
        knexModule?: typeof Knex | null | undefined;
        pgPool?: any | null;
    };
    unsubscribeTreeNodesAfter: number;
    readonly userInfo: UserInfo | null;
    SetUserInfo(userInfo: UserInfo, clearCaches?: boolean): Promise<void> | undefined;
    ClearCaches(): Promise<void>;
    tree: TreeNode<DBShape>;
    treeRequestWatchers: Set<TreeRequestWatcher>;
    UnsubscribeAll(): void;
    ValidateDBData?: (dbData: DBShape) => void;
    allTreeNodes: Set<TreeNode<any>>;
    NodesWhere(filterFunc: (node: TreeNode<any>) => boolean): TreeNode<any>[];
    GetStats(): GraphlinkStats;
}
export declare class GraphlinkStats {
    constructor(data?: Partial<GraphlinkStats>);
    attachedTreeNodes: number;
    nodesWithRequestedSubscriptions: number;
    nodesWithFulfilledSubscriptions: number;
}
export declare class UserInfo {
    id: string;
}
