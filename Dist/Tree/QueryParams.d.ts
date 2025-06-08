import { DocumentNode } from "@apollo/client";
import { JSONSchema7 } from "json-schema";
import { TreeNode } from "./TreeNode.js";
import { GQLIntrospector } from "../DBShape/GQLIntrospector.js";
export declare class QueryParams {
    static ParseString(dataStr: string): QueryParams;
    static ParseData(data: any): QueryParams;
    /** This implementation is ONLY here for easier debugging! Do NOT rely on this being present on a given QueryParams object. (instead call `QueryParams.ToJSON(params)`) */
    toString(): string;
    static ToJSON(self: QueryParams): string;
    /** This function cleans the data-structure. (ie. for requests with identical meanings but different json-strings, this makes them uniform)
     * Note that this is ONLY automatically called if passed to this library through the `GetDocs_Options.params` property; for other paths, you must call this Clean() function manually. */
    static Clean(self: QueryParams): QueryParams;
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
    toString(): string;
    constructor(initialData?: {
        treeNode: TreeNode<any>;
    } & Partial<QueryParams_Linked>);
    treeNode: TreeNode<any>;
    get CollectionName(): string;
    get DocSchemaName(): string;
    derivatives_state_introspectionCompleted: boolean;
    StateChangedForDerivatives(): boolean;
    private queryStr;
    QueryStr(recalcDerivatesIfStateChanged?: boolean): string;
    private graphQLQuery;
    GraphQLQuery(recalcDerivatesIfStateChanged?: boolean): DocumentNode;
    CalculateDerivatives(): void;
    ToQueryStr(): string;
}
/** Adds round-brackets around the passed string, eg. "(...)", if it's non-empty. */
export declare function WithBrackets(str: string | null | undefined): string;
export declare class ListChange {
    changeType: ListChangeType;
    idOfRemoved: string;
    data: any;
    /** docId -> hash (note: atm, this is only populated for list-changes of type `FullList`; caller must also supply a cachedEntryHashes arg, but it can be empty) */
    hashes: {
        [docId: string]: string;
    };
}
export declare enum ListChangeType {
    FullList = "FullList",
    EntryAdded = "EntryAdded",
    EntryChanged = "EntryChanged",
    EntryRemoved = "EntryRemoved"
}
export declare const gqlScalarTypes: string[];
export declare function JSONSchemaToGQLFieldsStr(schema: JSONSchema7, schemaName: string, introspector: GQLIntrospector): any;
