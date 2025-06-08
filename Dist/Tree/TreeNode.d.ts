import { Timer } from "js-vextensions";
import { ObservableMap } from "mobx";
import { FetchResult, Observable, ObservableSubscription } from "@apollo/client";
import { Graphlink } from "../Graphlink.js";
import { QueryParams, QueryParams_Linked } from "./QueryParams.js";
import { TreeNodeData } from "./TreeNodeData.js";
import { n } from "../Utils/@Internal/Types.js";
export declare enum TreeNodeType {
    Root = "Root",
    Collection = "Collection",
    CollectionQuery = "CollectionQuery",
    Document = "Document"
}
export declare enum SubscriptionStatus {
    Initial = "Initial",
    PrepForSubscribe = "PrepForSubscribe",
    WaitingForSubscribeComplete = "WaitingForSubscribeComplete",
    ReadyAndLive = "ReadyAndLive"
}
export declare class PathSubscription {
    constructor(unsubscribe: () => void);
    unsubscribe: () => void;
}
export declare class String_NotWrappedInGraphQL {
    str: string;
    toJSON(): string;
}
export declare const nodesByPath: Map<String, TreeNode<any>[]>;
export declare function PathSegmentsAreValid(pathSegments: string[]): boolean;
export type Doc_Base = {
    id: string;
    extras: object;
};
export declare class TreeNode<DataShape extends Doc_Base> {
    constructor(graph: Graphlink<any, any>, pathOrSegments: string | string[]);
    observedDataFields: Set<String>;
    countSecondsWithoutObserver_timer: Timer;
    get Data_ForDirectSubscriber(): DataShape | null;
    get DocDatas_ForDirectSubscriber(): any[];
    graph: Graphlink<any, any>;
    pathSegments: string[];
    pathSegments_noQuery: string[];
    path: string;
    path_noQuery: string;
    type: TreeNodeType;
    get ParentNode(): TreeNode<any> | null;
    MarkRequested(): void;
    Request(subscribeIfNotAlready?: boolean): void;
    private currentSubscribe_id?;
    /** Must be called from within a mobx action. (and not be run within a mobx computation) */
    SubscribeIfNotAlready(): void;
    Unsubscribe(allowKeepDataCached?: boolean): {
        observable: Observable<FetchResult<any, Record<string, any>, Record<string, any>>> | null;
        subscription: ObservableSubscription | null;
    } | null;
    UnsubscribeAll(allowKeepDataCached?: boolean, nodesThatHadActiveOrInitializingSub?: Set<TreeNode<any>>): Set<TreeNode<any>>;
    self_subscriptionStatus: SubscriptionStatus;
    self_apolloObservable: Observable<FetchResult<any, Record<string, any>, Record<string, any>>> | null;
    self_subscription: ObservableSubscription | null;
    data_fromParent: TreeNodeData<DataShape>;
    data_fromSelf: TreeNodeData<DataShape>;
    get PreferredDataContainer(): TreeNodeData<DataShape>;
    get PreferredData(): DataShape | null;
    get DocDatas(): any[];
    collectionNodes: ObservableMap<string, TreeNode<any>>;
    queryNodes: ObservableMap<string, TreeNode<any>>;
    query_raw: QueryParams;
    query: QueryParams_Linked | n;
    docNodes: ObservableMap<string, TreeNode<any>>;
    get AllChildNodes(): TreeNode<any>[];
    get AllDescendantNodes(): TreeNode<any>[];
    Get(subpathOrGetterFunc: string | string[] | ((data: DataShape) => any), createTreeNodesIfMissing: boolean): TreeNode<any> | null;
    get raw(): DataShape;
    AsRawData(addTreeLink?: boolean): DataShape;
    UploadRawData(rawData: DataShape): void;
}
export declare function GetTreeNodeTypeForPath(pathOrSegments: string | string[]): TreeNodeType;
export declare function TreeNodeToRawData<DataShape extends Doc_Base>(treeNode: TreeNode<DataShape>, addTreeLink?: boolean): DataShape;
