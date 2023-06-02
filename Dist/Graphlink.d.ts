import { TreeNode } from "./Tree/TreeNode.js";
import { TreeRequestWatcher } from "./Tree/TreeRequestWatcher.js";
import type Knex from "knex";
import { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import { AccessorCallPlan } from "./Accessors/@AccessorCallPlan.js";
import { DataCommitScheduler } from "./Components/DataCommitScheduler.js";
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
export declare class GraphlinkOptions {
    constructor(data?: Partial<GraphlinkOptions>);
    unsubscribeTreeNodesAfter: number;
    /** After each data-update, how long to wait for another data-update; if another occurs during this period, the timer is reset, and another wait occurs. (until max-wait is reached) */
    dataUpdateBuffering_minWait: number;
    dataUpdateBuffering_maxWait: number;
    dataUpdateBuffering_commitSetMaxFuncCount: number;
    dataUpdateBuffering_commitSetMaxTime: number;
    dataUpdateBuffering_breakDuration: number;
}
export declare class Graphlink<StoreShape, DBShape> {
    static instances: Graphlink<any, any>[];
    constructor(initOptions?: GraphlinkInitOptions<StoreShape>, options?: GraphlinkOptions);
    initialized: boolean;
    Initialize(initOptions: GraphlinkInitOptions<StoreShape>, options?: GraphlinkOptions): void;
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
    options: GraphlinkOptions;
    readonly userInfo: UserInfo | null;
    /** Can be called prior to Graphlink.Initialize(). */
    SetUserInfo(userInfo: UserInfo | null, clearCaches?: boolean, resubscribeAfter?: boolean): Promise<Set<TreeNode<any>> | undefined>;
    ClearCaches(): Promise<Set<TreeNode<any>>>;
    commitScheduler: DataCommitScheduler;
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
export declare let defaultGraphRefs: GraphRefs;
export declare function SetDefaultGraphRefs(opt: GraphRefs): void;
export interface GraphRefs<StoreShape = any, DBShape = any> {
    graph: Graphlink<StoreShape, DBShape>;
}
