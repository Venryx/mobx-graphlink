import { CE, E, emptyArray, emptyArray_forLoading } from "js-vextensions";
import { runInAction } from "mobx";
import { defaultGraphOptions } from "../Graphlink.js";
import { DataStatus } from "../Tree/TreeNode.js";
import { Bail } from "../Utils/General/BailManager.js";
import { DoX_ComputationSafe } from "../Utils/General/MobX.js";
import { PathOrPathGetterToPathSegments } from "../Utils/DB/DBPaths.js";
import { NotifyWaitingForDB } from "./Helpers.js";
/*
Why use explicit GetDocs, GetDoc, etc. calls instead of just Proxy's in mobx store fields?
1) It lets you add options (like filters) in a consistent way. (consistent among sync db-accesses, and, old: consistent with async db-accesses, eg. GetDocAsync)
2) It makes it visually clear where a db-access is taking place, as opposed to a mere store access.
*/
export class GetDocs_Options {
    constructor() {
        this.inLinkRoot = true;
        this.ifLoading_bail = true;
        this.ifLoading_returnVal = emptyArray_forLoading;
        //resultForEmpty? = emptyArray;
    }
}
GetDocs_Options.default = new GetDocs_Options();
export function GetDocs(options, collectionPathOrGetterFunc) {
    var _a;
    const opt = E(defaultGraphOptions, GetDocs_Options.default, options);
    let subpathSegments = PathOrPathGetterToPathSegments(collectionPathOrGetterFunc);
    //let pathSegments = opt.inLinkRoot ? opt.graph.rootPathSegments.concat(subpathSegments) : subpathSegments;
    let pathSegments = subpathSegments;
    if (CE(pathSegments).Any(a => a == null))
        return emptyArray;
    const treeNode = opt.graph.tree.Get(pathSegments, opt.params);
    // if already subscribed, just mark requested (reduces action-spam of GetDocs_Request)
    if (treeNode && treeNode.subscription) {
        treeNode.Request();
    }
    else {
        // we can't change observables from within computations, so do it in a moment (out of computation call-stack)
        DoX_ComputationSafe(() => runInAction("GetDocs_Request", () => {
            opt.graph.tree.Get(pathSegments, opt.params, true).Request();
        }));
        // we need this function to re-run once new TreeNode is created+subscribed, so access/watch parent TreeNode's collections map
        // edit: nevermind, works without -- since Get function already accesses the collectionNodes field
        //opt.graph.tree.Get(pathSegments.slice(0, -1))?.collectionNodes.entries();
        //opt.graph.tree.collectionNodes.entries();
    }
    if ((treeNode === null || treeNode === void 0 ? void 0 : treeNode.status) != DataStatus.Received_Full) {
        NotifyWaitingForDB(pathSegments.join("/"));
        if (opt.ifLoading_bail) {
            Bail(opt.ifLoading_bail_message);
        }
        return opt.ifLoading_returnVal;
    }
    /*let docNodes = Array.from(treeNode.docNodes.values());
    let docDatas = docNodes.map(docNode=>docNode.data);
    return docDatas;*/
    //return opt.fire.tree.Get(pathSegments, queryRequest)?.docDatas ?? emptyArray;
    let result = (_a = treeNode === null || treeNode === void 0 ? void 0 : treeNode.docDatas) !== null && _a !== void 0 ? _a : [];
    return result.length == 0 ? emptyArray : result; // to help avoid unnecessary react renders
}
/*export async function GetDocs_Async<DocT>(opt: FireOptions & GetDocs_Options, collectionPathOrGetterFunc: string | string[] | ((dbRoot: DBShape)=>ObservableMap<any, DocT>)): Promise<DocT[]> {
    opt = E(defaultFireOptions, opt);
    return GetAsync(()=>GetDocs_Async(opt, collectionPathOrGetterFunc));
}*/
export class GetDoc_Options {
    constructor() {
        this.inLinkRoot = true;
        this.ifLoading_bail = true;
        this.ifLoading_returnVal = undefined;
    }
}
GetDoc_Options.default = new GetDoc_Options();
export function GetDoc(options, docPathOrGetterFunc) {
    const opt = E(defaultGraphOptions, GetDoc_Options.default, options);
    let subpathSegments = PathOrPathGetterToPathSegments(docPathOrGetterFunc);
    //let pathSegments = opt.inLinkRoot ? opt.graph.rootPathSegments.concat(subpathSegments) : subpathSegments;
    let pathSegments = subpathSegments;
    if (CE(pathSegments).Any(a => a == null))
        return null;
    let treeNode = opt.graph.tree.Get(pathSegments);
    // if already subscribed, just mark requested (reduces action-spam of GetDoc_Request)
    if (treeNode && treeNode.subscription) {
        treeNode.Request();
    }
    else {
        // we can't change observables from within computations, so do it in a moment (out of computation call-stack)
        DoX_ComputationSafe(() => runInAction("GetDoc_Request", () => {
            opt.graph.tree.Get(pathSegments, undefined, true).Request();
        }));
    }
    //if (opt.undefinedForLoading && treeNode?.status != DataStatus.Received_Full) return undefined;
    if ((treeNode === null || treeNode === void 0 ? void 0 : treeNode.status) != DataStatus.Received_Full) {
        NotifyWaitingForDB(pathSegments.join("/"));
        if (opt.ifLoading_bail) {
            Bail(opt.ifLoading_bail_message);
        }
        return opt.ifLoading_returnVal;
    }
    return treeNode === null || treeNode === void 0 ? void 0 : treeNode.data;
}
/*export async function GetDoc_Async<DocT>(opt: FireOptions & GetDoc_Options, docPathOrGetterFunc: string | string[] | ((dbRoot: DBShape)=>DocT)): Promise<DocT> {
    opt = E(defaultFireOptions, opt);
    return GetAsync(()=>GetDoc_Async(opt, docPathOrGetterFunc));
}*/
/* GetDocField<DocT, FieldT>(docGetterFunc: (dbRoot: DBShape)=>DocT, fieldGetterFunc: (doc: DocT)=>FieldT, suboptions?: GetDocs_Options): FieldT {
}
export async GetDocField_Async<DocT, FieldT>(docGetterFunc: (dbRoot: DBShape)=>DocT, fieldGetterFunc: (doc: DocT)=>FieldT, suboptions?: GetDocs_Options): Promise<FieldT> {
} */ 
