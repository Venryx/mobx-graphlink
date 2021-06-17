var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Assert, CE, ToJSON, FromJSON } from "js-vextensions";
import { observable, runInAction } from "mobx";
import { PathOrPathGetterToPath, PathOrPathGetterToPathSegments } from "../Utils/PathHelpers.js";
import { _getGlobalState } from "mobx";
import { MaybeLog_Base } from "../Utils/General.js";
import { gql } from "@apollo/client/core/index.js";
import { collection_docSchemaName, GetSchemaJSON } from "../Extensions/SchemaHelpers.js";
export var TreeNodeType;
(function (TreeNodeType) {
    TreeNodeType[TreeNodeType["Root"] = 0] = "Root";
    TreeNodeType[TreeNodeType["Collection"] = 1] = "Collection";
    TreeNodeType[TreeNodeType["CollectionQuery"] = 2] = "CollectionQuery";
    TreeNodeType[TreeNodeType["Document"] = 3] = "Document";
})(TreeNodeType || (TreeNodeType = {}));
export var DataStatus;
(function (DataStatus) {
    DataStatus[DataStatus["Initial"] = 0] = "Initial";
    DataStatus[DataStatus["Waiting"] = 1] = "Waiting";
    DataStatus[DataStatus["Received_Cache"] = 2] = "Received_Cache";
    DataStatus[DataStatus["Received_Full"] = 3] = "Received_Full";
})(DataStatus || (DataStatus = {}));
export class PathSubscription {
    constructor(unsubscribe) {
        this.unsubscribe = unsubscribe;
    }
}
export class QueryParams {
    constructor(initialData) {
        CE(this).Extend(initialData);
    }
    static ParseString(dataStr) {
        return QueryParams.ParseData(FromJSON(dataStr));
    }
    static ParseData(data) {
        return new QueryParams(data);
    }
    toString() {
        //return ToJSON(CE(this).Including("variablesStr", "variables"));
        return ToJSON(this);
    }
}
/** Class specifies the filtering, sorting, etc. for a given TreeNode. */
// (comments based on usage with Postgraphile and https://github.com/graphile-contrib/postgraphile-plugin-connection-filter)
export class QueryParams_Linked extends QueryParams {
    constructor(initialData) {
        super();
        CE(this).Extend(initialData);
        if (this.treeNode.type != TreeNodeType.Root) {
            this.queryStr = this.ToQueryStr();
            this.graphQLQuery = gql(this.queryStr);
        }
    }
    get CollectionName() {
        return CE(this.treeNode.pathSegments_noQuery).XFromLast(this.treeNode.type == TreeNodeType.Document ? 1 : 0);
    }
    get DocShemaName() {
        //if (ObjectCE(this.treeNode.type).IsOneOf(TreeNodeType.Collection, TreeNodeType.CollectionQuery)) {
        const docSchemaName = collection_docSchemaName.get(this.CollectionName);
        Assert(docSchemaName, `No schema has been associated with collection "${this.CollectionName}". Did you forget the \`@Col("DOC_SCHEMA_NAME")\` decorator?`);
        return docSchemaName;
    }
    ToQueryStr() {
        var _a, _b, _c, _d;
        Assert(this.treeNode.type != TreeNodeType.Root, "Cannot create QueryParams for the root TreeNode.");
        const docSchema = GetSchemaJSON(this.DocShemaName);
        Assert(docSchema, `Cannot find schema with name "${this.DocShemaName}".`);
        let varsDefineAsStr = "";
        if (this.varsDefine) {
            varsDefineAsStr = `(${this.varsDefine})`;
        }
        let argsAsStr = "";
        const firstNonNullArg = (_d = (_c = (_b = (_a = this.first) !== null && _a !== void 0 ? _a : this.after) !== null && _b !== void 0 ? _b : this.last) !== null && _c !== void 0 ? _c : this.before) !== null && _d !== void 0 ? _d : this.filter;
        if (firstNonNullArg != null) {
            const argsObj = CE(this).Including("first", "after", "last", "before", "filter");
            if (argsObj.filter) {
                for (const [key, value] of Object.entries(argsObj.filter)) {
                    // if filter entry's value is falsy, remove (so user can use pattern type: `{prop: shouldRequire3 && {equalTo: 3}}`)
                    if (!value) {
                        delete argsObj[key];
                    }
                }
            }
            const argsAsStr_json = JSON.stringify(argsObj);
            argsAsStr = `(${argsAsStr_json.slice(1, -1)})`; // remove "{}", then wrap with "()"
        }
        if (this.treeNode.type == TreeNodeType.Document) {
            return `
				subscription DocInCollection_${this.CollectionName}${varsDefineAsStr} {
					${this.DocShemaName.toLowerCase()}${argsAsStr} {
						${CE(docSchema.properties).Pairs().map(a => a.key).join(" ")}
					}
				}
			`;
        }
        else {
            return `
				subscription Collection_${this.CollectionName}${varsDefineAsStr} {
					${this.CollectionName}${argsAsStr} {
						nodes { ${CE(docSchema.properties).Pairs().map(a => a.key).join(" ")} }
					}
				}
			`;
        }
    }
}
export class TreeNode {
    constructor(fire, pathOrSegments) {
        var _a;
        this.status = DataStatus.Initial;
        // for doc (and root) nodes
        this.collectionNodes = observable.map();
        // for collection (and collection-query) nodes
        this.queryNodes = observable.map(); // for collection nodes
        this.docNodes = observable.map();
        this.graph = fire;
        this.pathSegments = PathOrPathGetterToPathSegments(pathOrSegments);
        this.path = PathOrPathGetterToPath(pathOrSegments);
        const queryStr = ((_a = this.pathSegments.slice(-1)[0]) === null || _a === void 0 ? void 0 : _a.startsWith("@query:")) ? this.pathSegments.slice(-1)[0].substr("@query:".length) : null;
        this.pathSegments_noQuery = this.pathSegments.filter(a => !a.startsWith("@query:"));
        this.path_noQuery = this.pathSegments_noQuery.join("/");
        Assert(this.pathSegments.find(a => a == null || a.trim().length == 0) == null, `Path segments cannot be null/empty. @pathSegments(${this.pathSegments})`);
        this.type = GetTreeNodeTypeForPath(this.pathSegments);
        const query_raw = queryStr ? QueryParams.ParseString(queryStr) : new QueryParams();
        this.query = new QueryParams_Linked(Object.assign(Object.assign({}, query_raw), { treeNode: this }));
        /*if (this.type != TreeNodeType.Root) {
            this.query.treeNode = this;
            this.query.CalculateDerivatives();
        }*/
    }
    Request() {
        this.graph.treeRequestWatchers.forEach(a => a.nodesRequested.add(this));
        if (!this.subscription) {
            this.Subscribe();
        }
    }
    Subscribe() {
        Assert(this.type != TreeNodeType.Root, "Cannot subscribe to the tree root!");
        Assert(this.subscription == null, "Cannot subscribe more than once!");
        // old: wait till call-stack completes, so we don't violate "can't change observables from within computation" rule
        // we can't change observables from within computed values/funcs/store-accessors, so do it in a moment (out of computation call-stack)
        /*WaitXThenRun(0, ()=> {
            runInAction("TreeNode.Subscribe_prep", ()=>this.status = DataStatus.Waiting);
        });*/
        Assert(_getGlobalState().computationDepth == 0, "Cannot call TreeNode.Subscribe from within a computation.");
        runInAction("TreeNode.Subscribe_prep", () => this.status = DataStatus.Waiting);
        MaybeLog_Base(a => a.subscriptions, () => `Subscribing to: ${this.path}`);
        if (this.type == TreeNodeType.Document) {
            this.observable = this.graph.subs.apollo.subscribe({
                query: this.query.graphQLQuery,
                variables: this.query.vars,
            });
            this.subscription = this.observable.subscribe({
                //start: ()=>{},
                next: data => {
                    MaybeLog_Base(a => a.subscriptions, l => l(`Got doc snapshot. @path(${this.path}) @snapshot:`, data.data));
                    runInAction("TreeNode.Subscribe.onSnapshot_doc", () => {
                        this.SetData(data.data, false);
                    });
                },
                error: err => console.error("SubscriptionError:", err),
            });
        }
        else {
            this.observable = this.graph.subs.apollo.subscribe({
                query: this.query.graphQLQuery,
                variables: this.query.vars,
            });
            this.subscription = this.observable.subscribe({
                //start: ()=>{},
                next: data => {
                    const docs = data.data[CE(this.pathSegments_noQuery).Last()].nodes;
                    Assert(docs != null && docs instanceof Array);
                    const fromCache = false;
                    MaybeLog_Base(a => a.subscriptions, l => l(`Got collection snapshot. @path(${this.path}) @docs:`, docs));
                    runInAction("TreeNode.Subscribe.onSnapshot_collection", () => {
                        const deletedDocIDs = CE(Array.from(this.docNodes.keys())).Except(...docs.map(a => a.id));
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
                        const newStatus = fromCache ? DataStatus.Received_Cache : DataStatus.Received_Full;
                        // see comment in SetData for why we ignore this case
                        const isIgnorableStatusChange = !dataChanged && newStatus == DataStatus.Received_Cache && this.status == DataStatus.Received_Full;
                        if (newStatus != this.status && !isIgnorableStatusChange) {
                            this.status = newStatus;
                        }
                    });
                },
                error: err => console.error("SubscriptionError:", err),
            });
        }
    }
    Unsubscribe() {
        if (this.observable == null || this.subscription == null)
            return null;
        let { observable, subscription } = this;
        this.observable = null;
        this.subscription.unsubscribe();
        this.subscription = null;
        return { observable, subscription };
    }
    UnsubscribeAll() {
        this.Unsubscribe();
        this.collectionNodes.forEach(a => a.UnsubscribeAll());
        this.queryNodes.forEach(a => a.UnsubscribeAll());
        this.docNodes.forEach(a => a.UnsubscribeAll());
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
            //ProcessDBData(data, true, CE(this.pathSegments).Last());
            this.data = data;
            this.dataJSON = dataJSON;
        }
        const newStatus = fromCache ? DataStatus.Received_Cache : DataStatus.Received_Full;
        const isIgnorableStatusChange = !dataChanged && newStatus == DataStatus.Received_Cache && this.status == DataStatus.Received_Full;
        if (newStatus != this.status && !isIgnorableStatusChange) {
            //if (data != null) {
            //ProcessDBData(this.data, true, true, CE(this.pathSegments).Last()); // also add to proxy (since the mobx proxy doesn't expose non-enumerable props) // maybe rework
            this.status = newStatus;
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
        let docNodes = Array.from(this.docNodes.values()).filter(a => a.status == DataStatus.Received_Full && a.data != null);
        let docDatas = docNodes.map(docNode => docNode.data);
        //let docDatas = observable.array(docNodes.map(docNode=>docNode.data));
        return docDatas;
    }
    // default createTreeNodesIfMissing to false, so that it's safe to call this from a computation (which includes store-accessors)
    Get(subpathOrGetterFunc, query, createTreeNodesIfMissing = false) {
        let subpathSegments = PathOrPathGetterToPathSegments(subpathOrGetterFunc);
        let currentNode = this;
        let proceed_inAction = () => runInAction(`TreeNode.Get @path(${this.path})`, () => proceed(true));
        let proceed = (inAction) => {
            currentNode = this;
            for (let [index, segment] of subpathSegments.entries()) {
                let subpathSegmentsToHere = subpathSegments.slice(0, index + 1);
                let childNodesMap = currentNode[currentNode.type == TreeNodeType.Collection ? "docNodes" : "collectionNodes"];
                if (!childNodesMap.has(segment) && createTreeNodesIfMissing) {
                    if (!inAction)
                        return proceed_inAction(); // if not yet running in action, restart in one
                    //let pathToSegment = subpathSegments.slice(0, index).join("/");
                    childNodesMap.set(segment, new TreeNode(this.graph, this.pathSegments.concat(subpathSegmentsToHere)));
                }
                currentNode = childNodesMap.get(segment);
                if (currentNode == null)
                    break;
            }
            if (query && currentNode) {
                if (!currentNode.queryNodes.has(query.toString()) && createTreeNodesIfMissing) {
                    if (!inAction)
                        return proceed_inAction(); // if not yet running in action, restart in one
                    currentNode.queryNodes.set(query.toString(), new TreeNode(this.graph, this.pathSegments.concat(subpathSegments).concat("@query:" + query)));
                }
                currentNode = currentNode.queryNodes.get(query.toString());
            }
        };
        // first, try proceeding without runInAction 
        proceed(false);
        return currentNode;
    }
    get raw() { return this.AsRawData(); } // helper for in console
    AsRawData(addTreeLink = true) {
        return TreeNodeToRawData(this, addTreeLink);
    }
    UploadRawData(rawData) {
        // todo
    }
}
__decorate([
    observable
], TreeNode.prototype, "status", void 0);
__decorate([
    observable
], TreeNode.prototype, "collectionNodes", void 0);
__decorate([
    observable.ref
], TreeNode.prototype, "data", void 0);
__decorate([
    observable
], TreeNode.prototype, "queryNodes", void 0);
__decorate([
    observable
], TreeNode.prototype, "docNodes", void 0);
export function GetTreeNodeTypeForPath(pathOrSegments) {
    let pathSegments = PathOrPathGetterToPathSegments(pathOrSegments);
    if (pathSegments == null || pathSegments.length == 0)
        return TreeNodeType.Root;
    if (CE(pathSegments).Last().startsWith("@query:"))
        return TreeNodeType.CollectionQuery;
    return pathSegments.length % 2 == 1 ? TreeNodeType.Collection : TreeNodeType.Document;
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
    /*if (treeNode.docNodes) {
        let docsAsRawData = Array.from(treeNode.docNodes.values()).map(docNode=>TreeNodeToRawData(docNode));
        CE(result)._AddItem("_subs", docsAsRawData);
    }*/
    for (let [key, doc] of treeNode.docNodes) {
        result[key] = TreeNodeToRawData(doc);
    }
    return result;
}
