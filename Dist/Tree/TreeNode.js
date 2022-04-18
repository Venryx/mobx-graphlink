import { Assert, AssertWarn, CE, E, Timer, ToJSON } from "js-vextensions";
import { computed, observable, onBecomeObserved, onBecomeUnobserved } from "mobx";
import { CleanDBData } from "../Utils/DB/DBDataHelpers.js";
import { PathOrPathGetterToPath, PathOrPathGetterToPathSegments } from "../Utils/DB/DBPaths.js";
import { MaybeLog_Base } from "../Utils/General/General.js";
import { RunInAction_WhenAble, makeObservable_safe, MobX_AllowStateChanges, RunInAction } from "../Utils/General/MobX.js";
import { QueryParams, QueryParams_Linked } from "./QueryParams.js";
export var TreeNodeType;
(function (TreeNodeType) {
    TreeNodeType["Root"] = "Root";
    TreeNodeType["Collection"] = "Collection";
    TreeNodeType["CollectionQuery"] = "CollectionQuery";
    TreeNodeType["Document"] = "Document";
})(TreeNodeType || (TreeNodeType = {}));
export var DataStatus;
(function (DataStatus) {
    DataStatus["Initial"] = "Initial";
    DataStatus["Waiting"] = "Waiting";
    DataStatus["Received_Cache"] = "Received_Cache";
    DataStatus["Received_Live"] = "Received_Full";
    //Received_ButUnsubscribed = "Received_ButUnsubscribed",
})(DataStatus || (DataStatus = {}));
export function GetPreferenceLevelOfDataStatus(status) {
    switch (status) {
        case DataStatus.Initial: return 1;
        case DataStatus.Waiting: return 2;
        case DataStatus.Received_Cache: return 3;
        case DataStatus.Received_Live: return 4;
        //case DataStatus.Received_ButUnsubscribed: return 2.5;
    }
    return 0;
}
export class PathSubscription {
    constructor(unsubscribe) {
        this.unsubscribe = unsubscribe;
    }
}
//export const $varOfSameName = Symbol("$varOfSameName");
export class String_NotWrappedInGraphQL {
    toJSON() {
        return this.str; // don't put quotes around it
    }
}
// for debugging
export const nodesByPath = new Map();
export class TreeNode {
    constructor(fire, pathOrSegments) {
        var _a, _b;
        this.observedDataFields = new Set();
        this.status_forDirectSubscription = DataStatus.Initial; // [@O]
        // for doc (and root) nodes
        this.collectionNodes = observable.map(); // [@O]
        // for collection (and collection-query) nodes
        this.queryNodes = observable.map(); // [@O] for collection nodes
        this.docNodes = observable.map(); // [@O]
        fire.allTreeNodes.add(this);
        makeObservable_safe(this, {
            status_forDirectSubscription: observable,
            Status: computed,
            collectionNodes: observable,
            data: observable.ref,
            data_forDirectSubscriber: computed,
            queryNodes: observable,
            docNodes: observable,
            docDatas: computed,
            docDatas_forDirectSubscriber: computed,
        });
        this.graph = fire;
        this.pathSegments = PathOrPathGetterToPathSegments(pathOrSegments);
        this.path = PathOrPathGetterToPath(pathOrSegments);
        const queryStr = ((_a = this.pathSegments.slice(-1)[0]) === null || _a === void 0 ? void 0 : _a.startsWith("@query:")) ? this.pathSegments.slice(-1)[0].substr("@query:".length) : null;
        this.pathSegments_noQuery = this.pathSegments.filter(a => !a.startsWith("@query:"));
        this.path_noQuery = this.pathSegments_noQuery.join("/");
        Assert(this.pathSegments.find(a => a == null || a.trim().length == 0) == null, `Path segments cannot be null/empty. @pathSegments(${this.pathSegments})`);
        this.type = GetTreeNodeTypeForPath(this.pathSegments);
        const query_raw = queryStr ? QueryParams.ParseString(queryStr) : new QueryParams();
        this.query = new QueryParams_Linked({ ...query_raw, treeNode: this });
        /*if (this.type != TreeNodeType.Root) {
            this.query.treeNode = this;
            this.query.CalculateDerivatives();
        }*/
        if (this.type == TreeNodeType.Document) {
            this.query.varsDefine = ["$id: String!", this.query.varsDefine].filter(a => a).join(", ");
            //this.query.args_custom = {id: "$id"};
            this.query.args_rawPrefixStr = "id: $id";
            this.query.vars = E({ id: this.pathSegments.slice(-1)[0] }, this.query.vars);
            this.query.CalculateDerivatives();
        }
        const oldNodesOnPath = (_b = nodesByPath.get(this.path)) !== null && _b !== void 0 ? _b : [];
        //Assert(oldNodesOnPath.length == 0, `Found another TreeNode with the exact same path! @path:${this.path}`);
        AssertWarn(oldNodesOnPath.filter(a => a.subscription != null).length == 0, `Found another TreeNode with the exact same path, with a live subscription! @path:${this.path}`);
        nodesByPath.set(this.path, oldNodesOnPath.concat(this));
        this.countSecondsWithoutObserver_timer = new Timer(this.graph.unsubscribeTreeNodesAfter, () => {
            /*if (this.path_noQuery == "commandRuns/J5Vk5OYCRi-7tP6XtEBTQg") {
                let a = "test1";
            }
            console.log("At timer end... @path:", this.path, "@observedDataFields.size:", this.observedDataFields.size);*/
            // defensive; cancel unsubscribe if somehow we still have observers
            if (this.observedDataFields.size > 0)
                return;
            this.Unsubscribe();
            // todo: probably detach/completely-remove TreeNodes, in this case (to free up memory and such)
        }, 1);
        const OnDataFieldObservedStateChange = (field, newObservedState) => {
            /*if (this.path_noQuery == "commandRuns/J5Vk5OYCRi-7tP6XtEBTQg") {
                let a = "test2";
            }*/
            if (newObservedState) {
                this.observedDataFields.add(field);
            }
            else {
                this.observedDataFields.delete(field);
            }
            console.log("@path:", this.path, "@observedDataFields.size:", this.observedDataFields.size);
            if (this.observedDataFields.size == 0) {
                if (this.graph.unsubscribeTreeNodesAfter != -1) {
                    this.countSecondsWithoutObserver_timer.Start();
                }
            }
            else {
                this.countSecondsWithoutObserver_timer.Stop();
                if (this.subscription == null) {
                    RunInAction("TreeNode.OnDataFieldObservedStateChange.Resubscribe", () => {
                        this.Subscribe();
                    });
                }
            }
        };
        onBecomeObserved(this, "data_forDirectSubscriber", () => OnDataFieldObservedStateChange("data_forDirectSubscriber", true));
        onBecomeUnobserved(this, "data_forDirectSubscriber", () => OnDataFieldObservedStateChange("data_forDirectSubscriber", false));
        onBecomeObserved(this, "docDatas_forDirectSubscriber", () => OnDataFieldObservedStateChange("docDatas_forDirectSubscriber", true));
        onBecomeUnobserved(this, "docDatas_forDirectSubscriber", () => OnDataFieldObservedStateChange("docDatas_forDirectSubscriber", false));
        // just because a TreeNode was created, does not mean anyone is actually mobx-observing it; so start the unsubscribe timer as soon as it's created
        if (this.graph.unsubscribeTreeNodesAfter != -1) {
            this.countSecondsWithoutObserver_timer.Start();
        }
    }
    get ParentNode() {
        return this.graph.tree.Get(this.pathSegments.slice(0, -1));
    }
    Request() {
        this.graph.treeRequestWatchers.forEach(a => a.nodesRequested.add(this));
        if (!this.subscription) {
            this.Subscribe();
        }
    }
    /** Must be called from within a mobx action. (and not be run within a mobx computation) */
    Subscribe() {
        Assert(this.type != TreeNodeType.Root, "Cannot subscribe to the tree root!");
        Assert(this.subscription == null, "Cannot subscribe more than once!");
        // old: wait till call-stack completes, so we don't violate "can't change observables from within computation" rule
        // we can't change observables from within computed values/funcs/store-accessors, so do it in a moment (out of computation call-stack)
        /*WaitXThenRun(0, ()=> {
            runInAction("TreeNode.Subscribe_prep", ()=>this.status = DataStatus.Waiting);
        });*/
        //Assert(MobX_GetGlobalState().computationDepth == 0, "Cannot call TreeNode.Subscribe from within a computation.");
        Assert(MobX_AllowStateChanges(), "TreeNode.Subscribe must be called from within a mobx action. (and not be run within a mobx computation)");
        RunInAction("TreeNode.Subscribe_prep", () => this.status_forDirectSubscription = DataStatus.Waiting);
        MaybeLog_Base(a => a.subscriptions, l => l(`Subscribing to: ${this.path}`));
        if (this.type == TreeNodeType.Document) {
            this.apolloObservable = this.graph.subs.apollo.subscribe({
                query: this.query.GraphQLQuery,
                variables: this.query.vars,
            });
            this.subscription = this.apolloObservable.subscribe({
                //start: ()=>{},
                next: data => {
                    const returnedData = data.data; // if requested from top-level-query "map", data.data will have shape: {map: {...}}
                    //const returnedDocument = returnedData[Object.keys(this.query.vars!)[0]]; // so unwrap it here
                    Assert(Object.values(returnedData).length == 1);
                    const returnedDocument = Object.values(returnedData)[0]; // so unwrap it here
                    MaybeLog_Base(a => a.subscriptions, l => l(`Got doc snapshot. @path(${this.path}) @snapshot:`, returnedDocument));
                    RunInAction_WhenAble("TreeNode.Subscribe.onSnapshot_doc", () => {
                        this.SetData(returnedDocument, false);
                    });
                },
                error: err => console.error("SubscriptionError:", err),
            });
        }
        else {
            this.apolloObservable = this.graph.subs.apollo.subscribe({
                query: this.query.GraphQLQuery,
                variables: this.query.vars,
            });
            this.subscription = this.apolloObservable.subscribe({
                //start: ()=>{},
                next: data => {
                    const docs = data.data[CE(this.pathSegments_noQuery).Last()].nodes;
                    Assert(docs != null && docs instanceof Array);
                    const fromCache = false;
                    MaybeLog_Base(a => a.subscriptions, l => l(`Got collection snapshot. @path(${this.path}) @docs:`, docs));
                    RunInAction_WhenAble("TreeNode.Subscribe.onSnapshot_collection", () => {
                        const deletedDocIDs = CE(Array.from(this.docNodes.keys())).Exclude(...docs.map(a => a.id));
                        let dataChanged = false;
                        for (const doc of docs) {
                            if (!this.docNodes.has(doc.id)) {
                                this.docNodes.set(doc.id, new TreeNode(this.graph, this.pathSegments.concat([doc.id])));
                            }
                            //dataChanged = this.docNodes.get(doc.id)!.SetData(doc.data(), fromCache) || dataChanged;
                            dataChanged = this.docNodes.get(doc.id).SetData(doc, fromCache) || dataChanged;
                        }
                        for (const docID of deletedDocIDs) {
                            const docNode = this.docNodes.get(docID);
                            dataChanged = (docNode === null || docNode === void 0 ? void 0 : docNode.SetData(null, fromCache)) || dataChanged;
                            //docNode?.Unsubscribe(); // if someone subscribed directly, I guess we let them keep the detached subscription?
                            this.docNodes.delete(docID);
                        }
                        const newStatus = fromCache ? DataStatus.Received_Cache : DataStatus.Received_Live;
                        // see comment in SetData for why we ignore this case
                        const isIgnorableStatusChange = !dataChanged && newStatus == DataStatus.Received_Cache && this.status_forDirectSubscription == DataStatus.Received_Live;
                        if (newStatus != this.status_forDirectSubscription && !isIgnorableStatusChange) {
                            this.status_forDirectSubscription = newStatus;
                        }
                    });
                },
                error: err => console.error("SubscriptionError:", err),
            });
        }
    }
    Unsubscribe() {
        if (this.apolloObservable == null || this.subscription == null)
            return null;
        let { apolloObservable: observable, subscription } = this;
        this.apolloObservable = null;
        MaybeLog_Base(a => a.subscriptions, l => l(`Unsubscribing from: ${this.path}`));
        this.subscription.unsubscribe();
        this.subscription = null;
        RunInAction("TreeNode.Unsubscribe", () => this.status_forDirectSubscription = DataStatus.Initial);
        return { observable, subscription };
    }
    UnsubscribeAll() {
        this.Unsubscribe();
        this.collectionNodes.forEach(a => a.UnsubscribeAll());
        this.queryNodes.forEach(a => a.UnsubscribeAll());
        this.docNodes.forEach(a => a.UnsubscribeAll());
    }
    get Status() {
        var _a;
        // if there is a subscription on the collection overall, and it is more-resolved than our "direct subscription"...
        // ...then reflect the status of that parent collection node as our own (since we can receive data from the collection subscription as well)
        if (this.type == TreeNodeType.Document && this.ParentNode != null && this.ParentNode.subscription != null) {
            const parentNode_status_preferenceLevel = GetPreferenceLevelOfDataStatus((_a = this.ParentNode) === null || _a === void 0 ? void 0 : _a.status_forDirectSubscription);
            const self_status_preferenceLevel = GetPreferenceLevelOfDataStatus(this.status_forDirectSubscription);
            if (parentNode_status_preferenceLevel > self_status_preferenceLevel) {
                return this.ParentNode.status_forDirectSubscription;
            }
        }
        return this.status_forDirectSubscription;
    }
    get data_forDirectSubscriber() {
        return this.data;
    }
    SetData(data, fromCache) {
        // this.data being "undefined" is used to signify that it's still loading; so if firebase-given value is "undefined", change it to "null"
        if (data === undefined) {
            data = null;
        }
        // Note: with `includeMetadataChanges` enabled, firestore refreshes all subscriptions every half-hour or so. (first with fromCache:true, then with fromCache:false)
        // The checks below are how we keep those refreshes from causing unnecesary subscription-listener triggers. (since that causes unnecessary cache-breaking and UI updating)
        // (if needed, we could just *delay* the update: after X time passes, check if there was a subsequent from-server update that supersedes it -- only propogating the update if there wasn't one)
        const dataJSON = ToJSON(data);
        const dataChanged = dataJSON != this.dataJSON;
        if (dataChanged) {
            //console.log("Data changed from:", this.data, " to:", data, " @node:", this);
            //data = data ? observable(data_raw) as any : null;
            // for graphql system, not currently needed
            CleanDBData(data); //, this.pathSegments);
            this.data = data;
            this.dataJSON = dataJSON;
        }
        const newStatus = fromCache ? DataStatus.Received_Cache : DataStatus.Received_Live;
        const isIgnorableStatusChange = !dataChanged && newStatus == DataStatus.Received_Cache && this.status_forDirectSubscription == DataStatus.Received_Live;
        if (newStatus != this.status_forDirectSubscription && !isIgnorableStatusChange) {
            //if (data != null) {
            //ProcessDBData(this.data, true, true, CE(this.pathSegments).Last()); // also add to proxy (since the mobx proxy doesn't expose non-enumerable props) // maybe rework
            this.status_forDirectSubscription = newStatus;
            /*} else {
                // entry was deleted; reset status to "initial"
                this.status = DataStatus.Initial;
            }*/
        }
        return dataChanged;
    }
    //docNodes = new Map<string, TreeNode<any>>();
    get docDatas() {
        // (we need to filter for nodes where data is not nully, since such entries get added by GetDoc(...) calls for non-existent paths, but shouldn't show in docDatas array)
        //let docNodes = Array.from(this.docNodes.values()).filter(a=>a.status_forDirectSubscription == DataStatus.Received_Full && a.data != null);
        let docNodes = Array.from(this.docNodes.values()).filter(a => a.Status == DataStatus.Received_Live && a.data != null);
        let docDatas = docNodes.map(docNode => docNode.data);
        //let docDatas = observable.array(docNodes.map(docNode=>docNode.data));
        return docDatas;
    }
    get docDatas_forDirectSubscriber() {
        return this.docDatas;
    }
    get AllChildNodes() {
        return [
            ...this.collectionNodes.values(),
            ...this.queryNodes.values(),
            ...this.docNodes.values(),
        ];
    }
    get AllDescendantNodes() {
        return CE(this.AllChildNodes).SelectMany(a => a.AllDescendantNodes);
    }
    // default createTreeNodesIfMissing to false, so that it's safe to call this from a computation (which includes store-accessors)
    Get(subpathOrGetterFunc, query, createTreeNodesIfMissing = false) {
        let subpathSegments = PathOrPathGetterToPathSegments(subpathOrGetterFunc);
        let proceed_inAction = () => RunInAction(`TreeNode.Get @path(${this.path})`, () => proceed(true)); // cannot use DoX_ComputationSafe, since we need the return value
        //let proceed_inAction = ()=>DoX_ComputationSafe(`TreeNode.Get @path(${this.path})`, ()=>proceed(true));
        let proceed = (inAction) => {
            let currentNode = this;
            for (let [index, segment] of subpathSegments.entries()) {
                let subpathSegmentsToHere = subpathSegments.slice(0, index + 1);
                let childNodesMap = currentNode[currentNode.type == TreeNodeType.Collection ? "docNodes" : "collectionNodes"];
                // if tree-node is non-existent, we have to either create it (if permitted), or abort
                if (!childNodesMap.has(segment)) {
                    if (!createTreeNodesIfMissing)
                        return null; // if not permitted to create, abort
                    if (!inAction)
                        return proceed_inAction(); // if permitted to create, restart function in action (creation must be in action)
                    //let pathToSegment = subpathSegments.slice(0, index).join("/");
                    childNodesMap.set(segment, new TreeNode(this.graph, this.pathSegments.concat(subpathSegmentsToHere)));
                }
                currentNode = childNodesMap.get(segment);
            }
            // if a query is specified, we need to add one additional tree-node (one level deeper) for it
            if (query) {
                // make sure query object is an "actual instance of" QueryParams (else query.toString() will return useless "[object Object]")
                Object.setPrototypeOf(query, QueryParams.prototype);
                query.Clean(); // query must be cleaned now, before calling "toString()" (the keys need to be consistent)
                // if tree-node is non-existent, we have to either create it (if permitted), or abort
                if (!currentNode.queryNodes.has(query.toString())) {
                    if (!createTreeNodesIfMissing)
                        return null; // if not permitted to create, abort
                    if (!inAction)
                        return proceed_inAction(); // if permitted to create, restart function in action (creation must be in action)
                    currentNode.queryNodes.set(query.toString(), new TreeNode(this.graph, this.pathSegments.concat(subpathSegments).concat("@query:" + query)));
                }
                currentNode = currentNode.queryNodes.get(query.toString());
            }
            return currentNode;
        };
        // first, try proceeding without runInAction 
        return proceed(false);
    }
    get raw() { return this.AsRawData(); } // helper for in console
    AsRawData(addTreeLink = true) {
        return TreeNodeToRawData(this, addTreeLink);
    }
    UploadRawData(rawData) {
        // todo
    }
}
export function GetTreeNodeTypeForPath(pathOrSegments) {
    let pathSegments = PathOrPathGetterToPathSegments(pathOrSegments);
    if (pathSegments == null || pathSegments.length == 0)
        return TreeNodeType.Root;
    if (pathSegments.length == 1)
        return TreeNodeType.Collection;
    if (pathSegments.length == 2 || pathSegments.length == 3) {
        if (CE(pathSegments).Last().startsWith("@query:"))
            return TreeNodeType.CollectionQuery;
        return TreeNodeType.Document;
    }
    Assert(false, `Invalid TreeNode path. Cannot determine type. @path:${pathOrSegments}`);
    return null;
    //return pathSegments.length % 2 == 1 ? TreeNodeType.Collection : TreeNodeType.Document;
}
/*export function EnsurePathWatched(opt: FireOptions, path: string, filters?: Filter[]) {
    opt = E(defaultFireOptions, opt);
    let treeNode = opt.fire.tree.Get(path);
    if (treeNode.subscriptions.length) return;
    treeNode.Subscribe(filters ? new QueryParams({filters}) : null);
}*/
export function TreeNodeToRawData(treeNode, addTreeLink = true) {
    let result = {};
    if (addTreeLink) {
        CE(result)._AddItem("_node", treeNode);
    }
    CE(result)._AddItem("_path", treeNode.path);
    /*if (treeNode.data) {
        CE(result).Extend(treeNode.data);
    }*/
    result["data"] = treeNode.data;
    for (let [key, collection] of treeNode.collectionNodes) {
        result[key] = TreeNodeToRawData(collection);
    }
    for (let [key, collection] of treeNode.queryNodes) {
        result[key] = TreeNodeToRawData(collection);
    }
    /*if (treeNode.docNodes) {
        let docsAsRawData = Array.from(treeNode.docNodes.values()).map(docNode=>TreeNodeToRawData(docNode));
        CE(result)._AddItem("_subs", docsAsRawData);
    }*/
    for (let [key, doc] of treeNode.docNodes) {
        result[key] = TreeNodeToRawData(doc);
    }
    return result;
}
