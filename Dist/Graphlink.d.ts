import { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import { AccessorCallPlan } from "./Accessors/@AccessorCallPlan.js";
import { DataCommitScheduler } from "./Components/DataCommitScheduler.js";
import { TreeNode } from "./Tree/TreeNode.js";
import { TreeRequestWatcher } from "./Tree/TreeRequestWatcher.js";
import { GQLIntrospector } from "./DBShape/GQLIntrospector.js";
export declare class GraphlinkInitOptions<StoreShape> {
    rootStore: StoreShape;
    apollo: ApolloClient<NormalizedCacheObject>;
    onServer: boolean;
    /**
     * After X milliseconds of being unobserved, a TreeNode will unsubscribe its GraphQL subscription, by sending "stop" over the websocket.
     * Special values: 5000 (default), -1 (never auto-unsubscribe)
     * */
    unsubscribeTreeNodesAfter?: number;
    pgPool?: any;
}
export declare class GraphlinkOptions {
    constructor(data?: Partial<GraphlinkOptions>);
    useIntrospection: boolean;
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
    /** You must call graphlink.Initialize(...) after constructing the Graphlink instance. */
    constructor();
    initialized: boolean;
    Initialize(initOptions: GraphlinkInitOptions<StoreShape>, options?: GraphlinkOptions): Promise<void>;
    rootStore: StoreShape;
    storeOverridesStack: StoreShape[];
    /** Set this to false if you need to make sure all relevant database-requests within an accessor tree are being activated. */
    storeAccessorCachingTempDisabled: boolean;
    callPlan_callStack: AccessorCallPlan[];
    GetDeepestCallPlanCurrentlyRunning(): AccessorCallPlan;
    onServer: boolean;
    subs: {
        apollo: ApolloClient<NormalizedCacheObject>;
        pgPool?: any | null;
    };
    options: GraphlinkOptions;
    readonly userInfo: UserInfo | null;
    /** Can be called prior to Graphlink.Initialize(). */
    SetUserInfo(userInfo: UserInfo | null, clearCaches?: boolean, resubscribeAfter?: boolean): Promise<Set<TreeNode<any>> | undefined>;
    ClearCaches(): Promise<Set<TreeNode<any>>>;
    introspector: GQLIntrospector;
    commitScheduler: DataCommitScheduler;
    /**
     * This is set to true whenever a call-chain is running which was triggered by data being committed to the Graphlink tree. (ie. on data being received from server)
     * Example usage: For easier debugging of what userland code was running a particular accessor. (add conditional breakpoint, breaking only when `graph.inDataCommitChain == false`)
     * Related/alternative: `graph.callPlan_callStack.length > 1`
     * */
    inDataCommitChain: boolean;
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
