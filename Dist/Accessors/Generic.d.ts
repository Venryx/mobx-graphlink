import { ObservableMap } from "mobx";
import { GraphOptions } from "../Graphlink";
import { QueryRequest } from "../Tree/TreeNode";
import { DBShape } from "../UserTypes";
export declare class GetDocs_Options {
    static default: GetDocs_Options;
    inLinkRoot?: boolean | undefined;
    queryRequest?: QueryRequest;
    resultForLoading?: never[] | undefined;
}
export declare function GetDocs<DB = DBShape, DocT = any>(options: Partial<GraphOptions<any, DB>> & GetDocs_Options, collectionPathOrGetterFunc: string | string[] | ((dbRoot: DB) => ObservableMap<any, DocT>)): DocT[] | undefined;
export declare class GetDoc_Options {
    static default: GetDoc_Options;
    inLinkRoot?: boolean | undefined;
    resultForLoading?: undefined;
}
export declare function GetDoc<DB = DBShape, DocT = any>(options: Partial<GraphOptions<any, DB>> & GetDoc_Options, docPathOrGetterFunc: string | string[] | ((dbRoot: DB) => DocT)): DocT | null | undefined;
