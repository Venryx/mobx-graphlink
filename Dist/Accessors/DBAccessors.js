import { E, emptyArray, emptyArray_forLoading } from "js-vextensions";
import { defaultGraphRefs } from "../Graphlink.js";
import { PathSegmentsAreValid } from "../index.js";
import { TreeNodePlaceholder } from "../Tree/TreeRequestWatcher.js";
import { PathOrPathGetterToPathSegments } from "../Utils/DB/DBPaths.js";
import { Bail } from "../Utils/General/BailManager.js";
import { RunInAction_WhenAble, MobX_AllowStateChanges } from "../Utils/General/MobX.js";
export function NotifyRawDBAccess(graph) {
    const deepestCallPlanRunning = graph.GetDeepestCallPlanCurrentlyRunning();
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
        this.inLinkRoot = true;
        this.ifLoading_bail = true;
        this.ifLoading_returnVal = emptyArray_forLoading;
        //resultForEmpty? = emptyArray;
    }
}
GetDocs_Options.default = new GetDocs_Options();
export function GetDocs(options, collectionPathOrGetterFunc) {
    var _a;
    const opt = E(defaultGraphRefs, GetDocs_Options.default, options);
    if (!opt.graph.initialized)
        return opt.ifLoading_returnVal;
    NotifyRawDBAccess(opt.graph);
    const subpathSegments = PathOrPathGetterToPathSegments(collectionPathOrGetterFunc);
    //let pathSegments = opt.inLinkRoot ? opt.graph.rootPathSegments.concat(subpathSegments) : subpathSegments;
    const pathSegments = subpathSegments;
    if (!PathSegmentsAreValid(pathSegments))
        return emptyArray;
    // include a mobx-access of user-info; this way, the accessor-stack is refreshed when user-info changes (which we want, since RLS policies can cause results to change depending on user-info)
    //opt.graph.userInfo; // commented; not actually needed (the tree-nodes reset will trigger the accessor-stacks to refresh anyway)
    let treeNode = null;
    if (MobX_AllowStateChanges()) {
        treeNode = opt.graph.tree.Get(pathSegments, opt.params, true);
        treeNode.Request();
    }
    else {
        treeNode = opt.graph.tree.Get(pathSegments, opt.params);
        if (treeNode) {
            treeNode.MarkRequested();
        }
        else {
            // if no tree-node exists at target path, and we can't attach one atm, then add placeholder to "nodesRequested" set (so tree-request-watchers know there's still data being loaded)
            const placeholder = new TreeNodePlaceholder(pathSegments.join("/"));
            opt.graph.treeRequestWatchers.forEach(a => a.nodesRequested.add(placeholder));
        }
        // ensure a full attach+request is completed (in a moment, out of computation call-stack; we can't change observables from within computations)
        const inDataCommitChain_preWait = opt.graph.inDataCommitChain;
        let inDataCommitChain_afterWait;
        RunInAction_WhenAble("GetDocs_Request", () => {
            inDataCommitChain_afterWait = opt.graph.inDataCommitChain;
            if (inDataCommitChain_preWait)
                opt.graph.inDataCommitChain = inDataCommitChain_preWait;
            opt.graph.tree.Get(pathSegments, opt.params, true).Request();
        }, () => opt.graph.inDataCommitChain = inDataCommitChain_afterWait);
    }
    // always try to access the data (so that the tree-node knows it shouldn't unsubscribe itself)
    const data = treeNode === null || treeNode === void 0 ? void 0 : treeNode.DocDatas_ForDirectSubscriber;
    if (treeNode == null || !treeNode.PreferredDataContainer.IsDataAcceptableToConsume()) {
        if (opt.ifLoading_bail) {
            const bailMessage = (_a = opt.ifLoading_bail_message) !== null && _a !== void 0 ? _a : `Data not yet loaded at path "${pathSegments.join("/")}", and this call-path has no bail-handler.`; // no bail-handler IF message seen in ui
            Bail(bailMessage);
        }
        return opt.ifLoading_returnVal;
    }
    let result = data !== null && data !== void 0 ? data : [];
    if (result.length == 0)
        result = emptyArray; // to help avoid unnecessary react renders
    return result;
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
    var _a;
    const opt = E(defaultGraphRefs, GetDoc_Options.default, options);
    if (!opt.graph.initialized)
        return opt.ifLoading_returnVal;
    NotifyRawDBAccess(opt.graph);
    const subpathSegments = PathOrPathGetterToPathSegments(docPathOrGetterFunc);
    //let pathSegments = opt.inLinkRoot ? opt.graph.rootPathSegments.concat(subpathSegments) : subpathSegments;
    const pathSegments = subpathSegments;
    if (!PathSegmentsAreValid(pathSegments))
        return null;
    // include a mobx-access of user-info; this way, the accessor-stack is refreshed when user-info changes (which we want, since RLS policies can cause results to change depending on user-info)
    //opt.graph.userInfo; // commented; not actually needed (the tree-nodes reset will trigger the accessor-stacks to refresh anyway)
    let treeNode = null;
    if (MobX_AllowStateChanges()) {
        treeNode = opt.graph.tree.Get(pathSegments, undefined, true);
        treeNode.Request();
    }
    else {
        treeNode = opt.graph.tree.Get(pathSegments, undefined);
        if (treeNode) {
            treeNode.MarkRequested();
        }
        else {
            // if no tree-node exists at target path, and we can't attach one atm, then add placeholder to "nodesRequested" set (so tree-request-watchers know there's still data being loaded)
            const placeholder = new TreeNodePlaceholder(pathSegments.join("/"));
            opt.graph.treeRequestWatchers.forEach(a => a.nodesRequested.add(placeholder));
        }
        // ensure a full attach+request is completed (in a moment, out of computation call-stack; we can't change observables from within computations)
        const inDataCommitChain_preWait = opt.graph.inDataCommitChain;
        let inDataCommitChain_afterWait;
        RunInAction_WhenAble("GetDoc_Request", () => {
            inDataCommitChain_afterWait = opt.graph.inDataCommitChain;
            if (inDataCommitChain_preWait)
                opt.graph.inDataCommitChain = inDataCommitChain_preWait;
            opt.graph.tree.Get(pathSegments, undefined, true).Request();
        }, () => opt.graph.inDataCommitChain = inDataCommitChain_afterWait);
    }
    // always try to access the data (so that the tree-node knows it shouldn't unsubscribe itself)
    const data = treeNode === null || treeNode === void 0 ? void 0 : treeNode.Data_ForDirectSubscriber;
    if (treeNode == null || !treeNode.PreferredDataContainer.IsDataAcceptableToConsume()) {
        if (opt.ifLoading_bail) {
            const bailMessage = (_a = opt.ifLoading_bail_message) !== null && _a !== void 0 ? _a : `Data not yet loaded at path "${pathSegments.join("/")}", and this call-path has no bail-handler.`; // no bail-handler IF message seen in ui
            Bail(bailMessage);
        }
        return opt.ifLoading_returnVal;
    }
    return data;
}
/*export async function GetDoc_Async<DocT>(opt: FireOptions & GetDoc_Options, docPathOrGetterFunc: string | string[] | ((dbRoot: DBShape)=>DocT)): Promise<DocT> {
    opt = E(defaultFireOptions, opt);
    return GetAsync(()=>GetDoc_Async(opt, docPathOrGetterFunc));
}*/
/* GetDocField<DocT, FieldT>(docGetterFunc: (dbRoot: DBShape)=>DocT, fieldGetterFunc: (doc: DocT)=>FieldT, suboptions?: GetDocs_Options): FieldT {
}
export async GetDocField_Async<DocT, FieldT>(docGetterFunc: (dbRoot: DBShape)=>DocT, fieldGetterFunc: (doc: DocT)=>FieldT, suboptions?: GetDocs_Options): Promise<FieldT> {
} */ 
