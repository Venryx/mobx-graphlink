import { ObservableMap } from "mobx";
import { GraphRefs } from "../Graphlink.js";
import { Graphlink } from "../index.js";
import { QueryParams } from "../Tree/QueryParams.js";
import { UT_DBShape } from "../UserTypes.js";
export declare function NotifyRawDBAccess(graph: Graphlink<any, any>): void;
export declare class GetDocs_Options {
    static default: GetDocs_Options;
    inLinkRoot?: boolean | undefined;
    params?: QueryParams;
    ifLoading_bail?: boolean | undefined;
    ifLoading_bail_message?: string;
    ifLoading_returnVal?: any[] | undefined;
}
export declare function GetDocs<DB = UT_DBShape, DocT = any>(options: Partial<GraphRefs<any, DB>> & GetDocs_Options, collectionPathOrGetterFunc: string | string[] | ((dbRoot: DB) => ObservableMap<any, DocT>)): DocT[];
export declare class GetDoc_Options {
    static default: GetDoc_Options;
    inLinkRoot?: boolean | undefined;
    ifLoading_bail?: boolean | undefined;
    ifLoading_bail_message?: string;
    ifLoading_returnVal?: undefined;
}
export declare function GetDoc<DB = UT_DBShape, DocT = any>(options: Partial<GraphRefs<any, DB>> & GetDoc_Options, docPathOrGetterFunc: string | string[] | ((dbRoot: DB) => DocT)): DocT | null | undefined;
