import { Assert, AssertWarn, CE, Clone, E, Timer } from "js-vextensions";
import { computed, observable, onBecomeObserved, onBecomeUnobserved } from "mobx";
import { PathOrPathGetterToPath, PathOrPathGetterToPathSegments } from "../Utils/DB/DBPaths.js";
import { MaybeLog_Base } from "../Utils/General/General.js";
import { makeObservable_safe, MobX_AllowStateChanges, RunInAction } from "../Utils/General/MobX.js";
import { ListChangeType, QueryParams, QueryParams_Linked } from "./QueryParams.js";
import { GetPreferenceLevelOfDataStatus, TreeNodeData } from "./TreeNodeData.js";
import { NormalizeDocumentShape } from "./DocShapeNormalizer.js";
export var TreeNodeType;
(function (TreeNodeType) {
    TreeNodeType["Root"] = "Root";
    TreeNodeType["Collection"] = "Collection";
    TreeNodeType["CollectionQuery"] = "CollectionQuery";
    TreeNodeType["Document"] = "Document";
})(TreeNodeType || (TreeNodeType = {}));
export var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["Initial"] = "Initial";
    SubscriptionStatus["Waiting"] = "Waiting";
    SubscriptionStatus["ReadyAndLive"] = "ReadyAndLive";
})(SubscriptionStatus || (SubscriptionStatus = {}));
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
export function PathSegmentsAreValid(pathSegments) {
    return pathSegments.every(a => a != null && a.trim().length > 0);
}
export class TreeNode {
    constructor(graph, pathOrSegments) {
        var _a, _b;
        this.observedDataFields = new Set();
        // data
        // ==========
        // these fields are only related to data_fromSelf (not data_fromParent)
        this.self_subscriptionStatus = SubscriptionStatus.Initial; // [@O]
        this.data_fromParent = new TreeNodeData();
        this.data_fromSelf = new TreeNodeData();
        // hierarchy
        // ==========
        // for doc (and root) nodes
        this.collectionNodes = observable.map(); // [@O]
        //collectionNodes = new Map<string, TreeNode<any>>();
        // for collection (and collection-query) nodes
        this.queryNodes = observable.map(); // [@O] for collection nodes
        this.docNodes = observable.map(); // [@O]
        graph.allTreeNodes.add(this);
        makeObservable_safe(this, {
            // special proxy-fields
            Data_ForDirectSubscriber: computed,
            DocDatas_ForDirectSubscriber: computed,
            // data
            self_subscriptionStatus: observable,
            /*data_fromParent: observable.ref,
            data_fromSelf: observable.ref,*/
            PreferredDataContainer: computed,
            //PreferredDataStatus: computed,
            PreferredData: computed,
            DocDatas: computed,
            // hierarchy
            collectionNodes: observable,
            queryNodes: observable,
            docNodes: observable,
        });
        this.graph = graph;
        this.pathSegments = PathOrPathGetterToPathSegments(pathOrSegments);
        this.path = PathOrPathGetterToPath(pathOrSegments);
        const queryStr = ((_a = this.pathSegments.slice(-1)[0]) === null || _a === void 0 ? void 0 : _a.startsWith("@query:")) ? this.pathSegments.slice(-1)[0].slice("@query:".length) : null;
        this.pathSegments_noQuery = this.pathSegments.filter(a => !a.startsWith("@query:"));
        this.path_noQuery = this.pathSegments_noQuery.join("/");
        Assert(PathSegmentsAreValid(this.pathSegments), `Path segments cannot be null/empty. @pathSegments(${this.pathSegments})`);
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
        // only do these checks in dev-mode, since causes memory usage to keep going up (due to the map never being cleared)
        if (globalThis.DEV_DYN) {
            const oldNodesOnPath = (_b = nodesByPath.get(this.path)) !== null && _b !== void 0 ? _b : [];
            //Assert(oldNodesOnPath.length == 0, `Found another TreeNode with the exact same path! @path:${this.path}`);
            AssertWarn(oldNodesOnPath.filter(a => a.self_subscription != null).length == 0, `Found another TreeNode with the exact same path, with a live subscription! @path:${this.path}`);
            nodesByPath.set(this.path, oldNodesOnPath.concat(this));
        }
        this.countSecondsWithoutObserver_timer = new Timer(this.graph.options.unsubscribeTreeNodesAfter, () => {
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
            //console.log("@path:", this.path, "@observedDataFields.size:", this.observedDataFields.size);
            if (this.observedDataFields.size == 0) {
                if (this.graph.options.unsubscribeTreeNodesAfter != -1) {
                    this.countSecondsWithoutObserver_timer.Start();
                }
            }
            else {
                this.countSecondsWithoutObserver_timer.Stop();
                if (this.self_subscription == null) {
                    RunInAction("TreeNode.OnDataFieldObservedStateChange.Resubscribe", () => {
                        this.Subscribe();
                    });
                }
            }
        };
        onBecomeObserved(this, "Data_ForDirectSubscriber", () => OnDataFieldObservedStateChange("Data_ForDirectSubscriber", true));
        onBecomeUnobserved(this, "Data_ForDirectSubscriber", () => OnDataFieldObservedStateChange("Data_ForDirectSubscriber", false));
        onBecomeObserved(this, "DocDatas_ForDirectSubscriber", () => OnDataFieldObservedStateChange("DocDatas_ForDirectSubscriber", true));
        onBecomeUnobserved(this, "DocDatas_ForDirectSubscriber", () => OnDataFieldObservedStateChange("DocDatas_ForDirectSubscriber", false));
        // just because a TreeNode was created, does not mean anyone is actually mobx-observing it; so start the unsubscribe timer as soon as it's created
        if (this.graph.options.unsubscribeTreeNodesAfter != -1) {
            this.countSecondsWithoutObserver_timer.Start();
        }
    }
    // these are special proxies, that we use merely to keep track of if there are GetDoc/GetDocs calls still observing the given source-fields
    get Data_ForDirectSubscriber() {
        return this.PreferredData;
    }
    get DocDatas_ForDirectSubscriber() {
        return this.DocDatas;
    }
    get ParentNode() {
        return this.graph.tree.Get(this.pathSegments.slice(0, -1), false);
    }
    MarkRequested() {
        this.graph.treeRequestWatchers.forEach(a => a.nodesRequested.add(this));
    }
    Request(subscribeIfNotAlready = true) {
        this.MarkRequested();
        if (subscribeIfNotAlready && !this.self_subscription) {
            this.Subscribe();
        }
    }
    /** Must be called from within a mobx action. (and not be run within a mobx computation) */
    Subscribe() {
        Assert(this.type != TreeNodeType.Root, "Cannot subscribe to the tree root!");
        Assert(this.self_subscription == null, "Cannot subscribe more than once!");
        // old: wait till call-stack completes, so we don't violate "can't change observables from within computation" rule
        // we can't change observables from within computed values/funcs/store-accessors, so do it in a moment (out of computation call-stack)
        /*WaitXThenRun(0, ()=> {
            runInAction("TreeNode.Subscribe_prep", ()=>this.status = DataStatus.Waiting);
        });*/
        //Assert(MobX_GetGlobalState().computationDepth == 0, "Cannot call TreeNode.Subscribe from within a computation.");
        Assert(MobX_AllowStateChanges(), "TreeNode.Subscribe must be called from within a mobx action. (and not be run within a mobx computation)");
        RunInAction("TreeNode.Subscribe_prep", () => this.self_subscriptionStatus = SubscriptionStatus.Waiting);
        MaybeLog_Base(a => a.subscriptions, l => l(`Subscribing to: ${this.path}`));
        if (this.type == TreeNodeType.Document) {
            this.self_apolloObservable = this.graph.subs.apollo.subscribe({
                query: this.query.GraphQLQuery(),
                variables: this.query.vars,
            });
            this.self_subscription = this.self_apolloObservable.subscribe({
                next: data => {
                    const returnedData = data.data; // if requested from top-level-query "map", data.data will have shape: {map: {...}}
                    //const returnedDocument = returnedData[Object.keys(this.query.vars!)[0]]; // so unwrap it here
                    Assert(Object.values(returnedData).length == 1);
                    const returnedDocument_raw = Object.values(returnedData)[0]; // so unwrap it here
                    NormalizeDocumentShape(returnedDocument_raw, this.query.DocSchemaName, this.graph.introspector);
                    const returnedDocument = returnedDocument_raw;
                    MaybeLog_Base(a => a.subscriptions, l => l(`Got doc snapshot. @path(${this.path}) @snapshot:`, returnedDocument));
                    this.graph.commitScheduler.ScheduleDataUpdateCommit(() => {
                        this.data_fromSelf.SetData(returnedDocument, false);
                        this.self_subscriptionStatus = SubscriptionStatus.ReadyAndLive;
                    });
                },
                error: err => console.error("SubscriptionError:", err), // Does an error here mean the subscription is no longer valid? If so, we should probably unsubscribe->resubscribe.
                //complete: ()=>console.error("SubscriptionComplete."), // handling presumably useful, but oddly, neither "error" nor "complete" doesn't seem to trigger when server goes down
            });
        }
        else {
            this.self_apolloObservable = this.graph.subs.apollo.subscribe({
                query: this.query.GraphQLQuery(),
                variables: this.query.vars,
            });
            let lastSubscriptionResult_docIDs = [];
            this.self_subscription = this.self_apolloObservable.subscribe({
                next: data => {
                    //const prevDocs = this.DocDatas;
                    //const nextDocs = prevDocs.slice();
                    let addedOrChangedDocs = [];
                    let removedDocIDs = [];
                    const listChange = data.data[CE(this.pathSegments_noQuery).Last()];
                    Assert(listChange != null && listChange.data instanceof Array);
                    if (listChange.changeType == ListChangeType.FullList) {
                        // if full-list, just set the new docs
                        addedOrChangedDocs = listChange.data;
                        removedDocIDs = CE(lastSubscriptionResult_docIDs).Exclude(...listChange.data.map(a => a.id));
                    }
                    else if (listChange.changeType == ListChangeType.EntryAdded || listChange.changeType == ListChangeType.EntryChanged) {
                        for (const addedOrChangedDoc of listChange.data) {
                            addedOrChangedDocs.push(addedOrChangedDoc);
                        }
                    }
                    else if (listChange.changeType == ListChangeType.EntryRemoved) {
                        removedDocIDs.push(listChange.idOfRemoved);
                    }
                    const fromCache = false;
                    MaybeLog_Base(a => a.subscriptions, l => l(`Got collection snapshot. @path(${this.path}) @addedOrChanged:`, addedOrChangedDocs.length, "@removed:", removedDocIDs.length));
                    this.graph.commitScheduler.ScheduleDataUpdateCommit(() => {
                        let dataChanged = false;
                        // for each doc in the new result-set, ensure a node exists for it, and set/update its "from parent" data
                        for (const doc of addedOrChangedDocs) {
                            if (!this.docNodes.has(doc.id)) {
                                this.docNodes.set(doc.id, new TreeNode(this.graph, this.pathSegments.concat([doc.id])));
                            }
                            NormalizeDocumentShape(doc, this.query.DocSchemaName, this.graph.introspector);
                            //dataChanged = this.docNodes.get(doc.id)!.SetData(doc.data(), fromCache) || dataChanged;
                            dataChanged = this.docNodes.get(doc.id).data_fromParent.SetData(Clone(doc), fromCache) || dataChanged;
                        }
                        // if docs are leaving the result set, remove those nodes from the tree
                        for (const docID of removedDocIDs) {
                            const docNode = this.docNodes.get(docID);
                            dataChanged = (docNode === null || docNode === void 0 ? void 0 : docNode.data_fromParent.SetData(null, fromCache)) || dataChanged;
                            // if this collection-subscription was the only reason the leaving-result-set doc's node was attached, remove that node from the tree (we don't want to detach nodes with active subscriptions)
                            //if (docNode?.self_subscription == null) {
                            //docNode?.Unsubscribe(); // commented; unsubscribe not really needed (doc leaves collection -> list-ui updates -> old child-ui leaves -> doc-node unsubscribes organically after delay)
                            this.docNodes.delete(docID);
                        }
                        this.data_fromSelf.UpdateStatusAfterDataChange(dataChanged, fromCache);
                        this.self_subscriptionStatus = SubscriptionStatus.ReadyAndLive;
                        lastSubscriptionResult_docIDs = this.DocDatas.map(a => a.id);
                    });
                },
                error: err => console.error("SubscriptionError:", err), // Does an error here mean the subscription is no longer valid? If so, we should probably unsubscribe->resubscribe.
                //complete: ()=>console.error("SubscriptionComplete."), // handling presumably useful, but oddly, neither "error" nor "complete" doesn't seem to trigger when server goes down
            });
        }
    }
    Unsubscribe(allowKeepDataCached = true) {
        if (this.self_apolloObservable == null || this.self_subscription == null)
            return null;
        const { self_apolloObservable: self_apolloObservable_old, self_subscription: self_subscription_old } = this;
        this.self_apolloObservable = null;
        MaybeLog_Base(a => a.subscriptions, l => l(`Unsubscribing from: ${this.path}`));
        this.self_subscription.unsubscribe();
        this.self_subscription = null;
        RunInAction("TreeNode.Unsubscribe", () => this.self_subscriptionStatus = SubscriptionStatus.Initial);
        this.data_fromSelf.NotifySubscriptionDropped(allowKeepDataCached);
        return { observable: self_apolloObservable_old, subscription: self_subscription_old };
    }
    UnsubscribeAll(allowKeepDataCached = true, nodesThatHadActiveSubscription = new Set()) {
        if (this.self_subscription != null) {
            nodesThatHadActiveSubscription.add(this);
        }
        this.Unsubscribe(allowKeepDataCached);
        this.collectionNodes.forEach(a => a.UnsubscribeAll(allowKeepDataCached, nodesThatHadActiveSubscription));
        this.queryNodes.forEach(a => a.UnsubscribeAll(allowKeepDataCached, nodesThatHadActiveSubscription));
        this.docNodes.forEach(a => a.UnsubscribeAll(allowKeepDataCached, nodesThatHadActiveSubscription));
        return nodesThatHadActiveSubscription;
    }
    get PreferredDataContainer() {
        if (this.type == TreeNodeType.Document) {
            const prefLevel_fromParent = GetPreferenceLevelOfDataStatus(this.data_fromParent.status);
            const prefLevel_fromSelf = GetPreferenceLevelOfDataStatus(this.data_fromSelf.status);
            if (prefLevel_fromParent > prefLevel_fromSelf) {
                return this.data_fromParent;
            }
            return this.data_fromSelf;
        }
        return this.data_fromSelf;
    }
    /*get PreferredDataStatus() { // [@computed]
        const preferredContainer = this.PreferredDataContainer;
        return GetPreferenceLevelOfDataStatus(preferredContainer.status);
    }*/
    get PreferredData() {
        return this.PreferredDataContainer.data;
    }
    /*SetData(data: DataShape, fromCache: boolean, containerField: "data_fromParent" | "data_fromSelf") {
        let container = containerField == "data_fromParent" ? this.data_fromParent : this.data_fromSelf;
        return container.SetData(data, fromCache);
    }*/
    get DocDatas() {
        //let docNodes = Array.from(this.docNodes.values()).filter(a=>a.status_forDirectSubscription == DataStatus.Received_Full && a.data != null);
        //let docNodes = Array.from(this.docNodes.values()).filter(a=>a.IsDataAcceptableToConsume(true));
        // for collections, we need to filter out nodes that were found (or at least requested) at some point, but whose data is now null (collections should never have null items)
        const docNodes = Array.from(this.docNodes.values()).filter(a => a.data_fromParent.data != null);
        const docDatas = docNodes.map(docNode => docNode.data_fromParent.data);
        //let docDatas = observable.array(docNodes.map(docNode=>docNode.data));
        return docDatas;
    }
    //docNodes = new Map<string, TreeNode<any>>();
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
    Get(subpathOrGetterFunc, createTreeNodesIfMissing) {
        const subpathSegments = PathOrPathGetterToPathSegments(subpathOrGetterFunc);
        const proceed_inAction = () => RunInAction(`TreeNode.Get @path(${this.path})`, () => proceed(true)); // cannot use DoX_ComputationSafe, since we need the return value
        //let proceed_inAction = ()=>DoX_ComputationSafe(`TreeNode.Get @path(${this.path})`, ()=>proceed(true));
        const proceed = (inAction) => {
            let currentNode = this;
            for (const [index, segment] of subpathSegments.entries()) {
                const subpathSegmentsToHere = subpathSegments.slice(0, index + 1);
                const childNodesPropName = segment.startsWith("@query:") ? "queryNodes" :
                    currentNode.type == TreeNodeType.Collection ? "docNodes" :
                        "collectionNodes";
                const childNodesMap = currentNode[childNodesPropName];
                const segmentAsMapKey = segment.startsWith("@query:") ? segment.slice("@query:".length) : segment;
                // if tree-node is non-existent, we have to either create it (if permitted), or abort
                if (!childNodesMap.has(segmentAsMapKey)) {
                    if (!createTreeNodesIfMissing)
                        return null; // if not permitted to create, abort
                    if (!inAction)
                        return proceed_inAction(); // if permitted to create, restart function in action (creation must be in action)
                    //let pathToSegment = subpathSegments.slice(0, index).join("/");
                    childNodesMap.set(segmentAsMapKey, new TreeNode(this.graph, this.pathSegments.concat(subpathSegmentsToHere)));
                }
                currentNode = childNodesMap.get(segmentAsMapKey);
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
    const pathSegments = PathOrPathGetterToPathSegments(pathOrSegments);
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
    const result = {};
    if (addTreeLink) {
        CE(result)._AddItem("_node", treeNode);
    }
    CE(result)._AddItem("_path", treeNode.path);
    /*if (treeNode.data) {
        CE(result).Extend(treeNode.data);
    }*/
    result["data"] = treeNode.PreferredData;
    for (const [key, collection] of treeNode.collectionNodes) {
        result[key] = TreeNodeToRawData(collection);
    }
    for (const [key, collection] of treeNode.queryNodes) {
        result[key] = TreeNodeToRawData(collection);
    }
    /*if (treeNode.docNodes) {
        let docsAsRawData = Array.from(treeNode.docNodes.values()).map(docNode=>TreeNodeToRawData(docNode));
        CE(result)._AddItem("_subs", docsAsRawData);
    }*/
    for (const [key, doc] of treeNode.docNodes) {
        result[key] = TreeNodeToRawData(doc);
    }
    return result;
}
