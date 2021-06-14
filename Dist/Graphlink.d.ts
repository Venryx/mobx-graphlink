import { TreeNode } from "./Tree/TreeNode.js";
import { TreeRequestWatcher } from "./Tree/TreeRequestWatcher.js";
import { ApolloClient, NormalizedCacheObject } from "@apollo/client/core";
export declare let defaultGraphOptions: GraphOptions;
export declare function SetDefaultGraphOptions(opt: GraphOptions): void;
export interface GraphOptions<RootStoreShape = any, DBShape = any> {
    graph: Graphlink<RootStoreShape, DBShape>;
}
export declare class GraphlinkInitOptions<RootStoreShape> {
    rootStore: RootStoreShape;
    apollo: ApolloClient<NormalizedCacheObject>;
}
export declare class Graphlink<RootStoreShape, DBShape> {
    static instances: Graphlink<any, any>[];
    constructor(initOptions?: GraphlinkInitOptions<RootStoreShape>);
    initialized: boolean;
    Initialize(initOptions: GraphlinkInitOptions<RootStoreShape>): void;
    rootStore: RootStoreShape;
    storeOverridesStack: RootStoreShape[];
    subs: {
        apollo: ApolloClient<NormalizedCacheObject>;
    };
    tree: TreeNode<DBShape>;
    treeRequestWatchers: Set<TreeRequestWatcher>;
    UnsubscribeAll(): void;
    ValidateDBData?: (dbData: DBShape) => void;
}
