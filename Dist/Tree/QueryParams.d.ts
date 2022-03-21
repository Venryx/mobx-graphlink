import { JSONSchema7 } from "json-schema";
import { DocumentNode } from "../Utils/@NPMFixes/apollo_client.js";
import { TreeNode } from "./TreeNode.js";
export declare class QueryParams {
    static ParseString(dataStr: string): QueryParams;
    static ParseData(data: any): QueryParams;
    toString(): string;
    /** This function cleans the data-structure. (ie. requests with identical meanings but different json-strings, are made uniform) */
    Clean?(): this;
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
    private queryStr;
    get QueryStr(): string;
    private graphQLQuery;
    get GraphQLQuery(): DocumentNode;
    CalculateDerivatives(): void;
    ToQueryStr(): string;
}
/** Adds round-brackets around the passed string, eg. "(...)", if it's non-empty. */
export declare function WithBrackets(str: string | null | undefined): string;
export declare const gqlScalarTypes: string[];
export declare function JSONSchemaToGQLFieldsStr(schema: JSONSchema7, schemaName: string): any;
