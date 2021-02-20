/// <reference types="zen-observable" />
import { ObservableMap } from "mobx";
import { Graphlink } from "../Graphlink";
import { DocumentNode, FetchResult } from "@apollo/client/core";
import { Observable } from "@apollo/client/utilities";
export declare enum TreeNodeType {
    Root = 0,
    Collection = 1,
    CollectionQuery = 2,
    Document = 3
}
export declare enum DataStatus {
    Initial = 0,
    Waiting = 1,
    Received_Cache = 2,
    Received_Full = 3
}
export declare class PathSubscription {
    constructor(unsubscribe: () => void);
    unsubscribe: () => void;
}
/** Class specifies the filtering, sorting, etc. for a given TreeNode. */
export declare class QueryRequest {
    static ParseString(dataStr: string): QueryRequest;
    static ParseData(data: any): QueryRequest;
    toString(): any;
    constructor(initialData?: Partial<QueryRequest>);
    collectionName: string;
    /** Example: "$limit: Int!, $maxValue: Int!" */
    variablesStr: string;
    /** Example: "first: $limit, filter: {someProp: {lessThan: $maxValue}}" */
    filterStr: string;
    /** Example: {limit: 10, maxValue: 100} */
    variables: Object;
    queryStr: string;
    graphQLQuery: DocumentNode;
    CalculateDerivatives(): void;
    ToQueryStr(): string;
}
export declare class TreeNode<DataShape> {
    constructor(fire: Graphlink<any, any>, pathOrSegments: string | string[]);
    graph: Graphlink<any, any>;
    pathSegments: string[];
    pathSegments_noQuery: string[];
    path: string;
    path_noQuery: string;
    type: TreeNodeType;
    Request(): void;
    Subscribe(): void;
    Unsubscribe(): {
        observable: Observable<FetchResult<any, Record<string, any>, Record<string, any>>>;
        subscription: ZenObservable.Subscription;
    } | null;
    UnsubscribeAll(): void;
    status: DataStatus;
    observable: Observable<FetchResult<any, Record<string, any>, Record<string, any>>> | null;
    subscription: ZenObservable.Subscription | null;
    collectionNodes: ObservableMap<string, TreeNode<any>>;
    data: DataShape;
    dataJSON: string;
    SetData(data: DataShape, fromCache: boolean): boolean;
    queryNodes: ObservableMap<string, TreeNode<any>>;
    query: QueryRequest;
    docNodes: ObservableMap<string, TreeNode<any>>;
    get docDatas(): any[];
    Get(subpathOrGetterFunc: string | string[] | ((data: DataShape) => any), query?: QueryRequest, createTreeNodesIfMissing?: boolean): TreeNode<any> | null;
    get raw(): DataShape;
    AsRawData(addTreeLink?: boolean): DataShape;
    UploadRawData(rawData: DataShape): void;
}
export declare function GetTreeNodeTypeForPath(pathOrSegments: string | string[]): TreeNodeType;
export declare function TreeNodeToRawData<DataShape>(treeNode: TreeNode<DataShape>, addTreeLink?: boolean): DataShape;
