import { CE, E, emptyArray, emptyArray_forLoading } from "js-vextensions";
import { defaultGraphOptions } from "../Graphlink.js";
import { DataStatus } from "../Tree/TreeNode.js";
import { PathOrPathGetterToPathSegments } from "../Utils/DB/DBPaths.js";
import { Bail } from "../Utils/General/BailManager.js";
import { DoX_ComputationSafe, RunInAction } from "../Utils/General/MobX.js";
import { GetDeepestCallPlanCurrentlyRunning } from "./CreateAccessor.js";
import { NotifyWaitingForDB } from "./Helpers.js";
export function NotifyRawDBAccess() {
    const deepestCallPlanRunning = GetDeepestCallPlanCurrentlyRunning();
    if (deepestCallPlanRunning) {
        deepestCallPlanRunning.accessorMeta.madeRawDBAccess = true;
        deepestCallPlanRunning.callPlanMeta.madeRawDBAccess = true;
    }
}
/*
Why use explicit GetDocs, GetDoc, etc. calls instead of just Proxy's in mobx store fields?
1) It lets you add options (like filters) in a consistent way. (consistent among sync db-accesses, and, old: consistent with async db-accesses, eg. GetDocAsync)
2) It makes it visually clear where a db-access is taking place, as opposed to a mere store access.
*/
export class GetDocs_Options {
    constructor() {
        Object.defineProperty(this, "inLinkRoot", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        //queryOps?: QueryOp[];
        Object.defineProperty(this, "params", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ifLoading_bail", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "ifLoading_bail_message", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ifLoading_returnVal", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: emptyArray_forLoading
        });
        //resultForEmpty? = emptyArray;
    }
}
Object.defineProperty(GetDocs_Options, "default", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new GetDocs_Options()
});
export function GetDocs(options, collectionPathOrGetterFunc) {
    var _a;
    NotifyRawDBAccess();
    const opt = E(defaultGraphOptions, GetDocs_Options.default, options);
    let subpathSegments = PathOrPathGetterToPathSegments(collectionPathOrGetterFunc);
    //let pathSegments = opt.inLinkRoot ? opt.graph.rootPathSegments.concat(subpathSegments) : subpathSegments;
    let pathSegments = subpathSegments;
    if (CE(pathSegments).Any(a => a == null))
        return emptyArray;
    // include a mobx-access of user-info; this way, the accessor-stack is refreshed when user-info changes (which we want, since RLS policies can cause results to change depending on user-info)
    //opt.graph.userInfo; // commented; not actually needed (the tree-nodes reset will trigger the accessor-stacks to refresh anyway)
    const treeNode = opt.graph.tree.Get(pathSegments, opt.params);
    // if already subscribed, just mark requested (reduces action-spam of GetDocs_Request)
    if (treeNode && treeNode.subscription) {
        treeNode.Request();
    }
    else {
        // we can't change observables from within computations, so do it in a moment (out of computation call-stack)
        DoX_ComputationSafe(() => RunInAction("GetDocs_Request", () => {
            opt.graph.tree.Get(pathSegments, opt.params, true).Request();
        }));
        // if tree-node still not created yet (due to waiting a tick so can start mobx action), add placeholder entry, so tree-request-watchers know there's still data being loaded
        // todo: improve this (eg. make-so watchers know they may receive mere placeholder entries)
        if (opt.graph.tree.Get(pathSegments, opt.params) == null) {
            const placeholder = { "_note": "This is a placeholder; data is still loading, but its tree-node hasn't been created yet, so this is its placeholder." };
            opt.graph.treeRequestWatchers.forEach(a => a.nodesRequested.add(placeholder));
        }
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
        Object.defineProperty(this, "inLinkRoot", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "ifLoading_bail", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "ifLoading_bail_message", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ifLoading_returnVal", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: undefined
        });
    }
}
Object.defineProperty(GetDoc_Options, "default", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new GetDoc_Options()
});
export function GetDoc(options, docPathOrGetterFunc) {
    NotifyRawDBAccess();
    const opt = E(defaultGraphOptions, GetDoc_Options.default, options);
    let subpathSegments = PathOrPathGetterToPathSegments(docPathOrGetterFunc);
    //let pathSegments = opt.inLinkRoot ? opt.graph.rootPathSegments.concat(subpathSegments) : subpathSegments;
    let pathSegments = subpathSegments;
    if (CE(pathSegments).Any(a => a == null))
        return null;
    // include a mobx-access of user-info; this way, the accessor-stack is refreshed when user-info changes (which we want, since RLS policies can cause results to change depending on user-info)
    //opt.graph.userInfo; // commented; not actually needed (the tree-nodes reset will trigger the accessor-stacks to refresh anyway)
    let treeNode = opt.graph.tree.Get(pathSegments);
    // if already subscribed, just mark requested (reduces action-spam of GetDoc_Request)
    if (treeNode && treeNode.subscription) {
        treeNode.Request();
    }
    else {
        // we can't change observables from within computations, so do it in a moment (out of computation call-stack)
        DoX_ComputationSafe(() => RunInAction("GetDoc_Request", () => {
            opt.graph.tree.Get(pathSegments, undefined, true).Request();
        }));
        // if tree-node still not created yet (due to waiting a tick so can start mobx action), add placeholder entry, so tree-request-watchers know there's still data being loaded
        // todo: improve this (eg. make-so watchers know they may receive mere placeholder entries)
        if (opt.graph.tree.Get(pathSegments) == null) {
            const placeholder = { "_note": "This is a placeholder; data is still loading, but its tree-node hasn't been created yet, so this is its placeholder." };
            opt.graph.treeRequestWatchers.forEach(a => a.nodesRequested.add(placeholder));
        }
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
