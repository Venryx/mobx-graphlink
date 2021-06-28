/// <reference types="zen-observable" />
import { DocumentNode, FetchResult } from "@apollo/client/core/index.js";
import { Observable } from "@apollo/client/utilities/index.js";
import { ObservableMap } from "mobx";
import { Graphlink } from "../Graphlink.js";
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
export declare class QueryParams {
    static ParseString(dataStr: string): QueryParams;
    static ParseData(data: any): QueryParams;
    toString(): string;
    constructor(initialData?: Partial<QueryParams_Linked>);
    /** Example: "$limit: Int!, $maxValue: Int!" */
    varsDefine?: string;
    /** Example: {limit: 10, maxValue: 100} */
    vars?: Object;
    args_rawPrefixStr?: string;
    args_custom?: Object;
    /** Example: {someProp: {lessThan: $maxValue}}*/
    filter?: Object;
    first?: number;
    after?: string;
    last?: number;
    before?: string;
}
/** Class specifies the filtering, sorting, etc. for a given TreeNode. */
export declare class QueryParams_Linked extends QueryParams {
    constructor(initialData?: {
        treeNode: TreeNode<any>;
    } & Partial<QueryParams_Linked>);
    treeNode: TreeNode<any>;
    get CollectionName(): string;
    get DocSchemaName(): string;
    private queryStr;
    get QueryStr(): string;
    private graphQLQuery;
    get GraphQLQuery(): DocumentNode;
    CalculateDerivatives(): void;
    ToQueryStr(): string;
}
export declare class String_NotWrappedInGraphQL {
    str: string;
    toJSON(): string;
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
    query: QueryParams_Linked;
    docNodes: ObservableMap<string, TreeNode<any>>;
    get docDatas(): any[];
    Get(subpathOrGetterFunc: string | string[] | ((data: DataShape) => any), query?: QueryParams, createTreeNodesIfMissing?: boolean): TreeNode<any> | null;
    get raw(): DataShape;
    AsRawData(addTreeLink?: boolean): DataShape;
    UploadRawData(rawData: DataShape): void;
}
export declare function GetTreeNodeTypeForPath(pathOrSegments: string | string[]): TreeNodeType;
export declare function TreeNodeToRawData<DataShape>(treeNode: TreeNode<DataShape>, addTreeLink?: boolean): DataShape;
