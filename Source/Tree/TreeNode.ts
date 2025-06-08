import {Assert, AssertWarn, CE, Clone, E, Timer, ToJSON} from "js-vextensions";
import {computed, makeObservable, observable, ObservableMap, onBecomeObserved, onBecomeUnobserved, runInAction, _getGlobalState} from "mobx";
import {FetchResult, Observable, ObservableSubscription} from "@apollo/client";
import {Graphlink} from "../Graphlink.js";
import {CleanDBData} from "../Utils/DB/DBDataHelpers.js";
import {PathOrPathGetterToPath, PathOrPathGetterToPathSegments} from "../Utils/DB/DBPaths.js";
import {MaybeLog_Base} from "../Utils/General/General.js";
import {RunInAction_WhenAble, makeObservable_safe, MobX_AllowStateChanges, MobX_GetGlobalState, RunInAction, RunInNextTick_BundledInOneAction} from "../Utils/General/MobX.js";
import {ListChange, ListChangeType, QueryParams, QueryParams_Linked} from "./QueryParams.js";
import {DataStatus, GetPreferenceLevelOfDataStatus, TreeNodeData} from "./TreeNodeData.js";
import {NormalizeDocumentShape} from "./DocShapeNormalizer.js";
import {CachedEntry_Core, entryCache} from "../Components/EntryCache.js";
import {GenerateUUID} from "../Extensions/KeyGenerator.js";
import {n} from "../Utils/@Internal/Types.js";

export enum TreeNodeType {
	Root = "Root",
	Collection = "Collection",
	CollectionQuery = "CollectionQuery",
	Document = "Document",
}

export enum SubscriptionStatus {
	Initial = "Initial",
	PrepForSubscribe = "PrepForSubscribe",
	WaitingForSubscribeComplete = "WaitingForSubscribeComplete",
	ReadyAndLive = "ReadyAndLive",
}

export class PathSubscription {
	constructor(unsubscribe: ()=>void) {
		this.unsubscribe = unsubscribe;
	}
	unsubscribe: ()=>void;
}

//export const $varOfSameName = Symbol("$varOfSameName");
export class String_NotWrappedInGraphQL {
	str: string;
	toJSON() {
		return this.str; // don't put quotes around it
	}
}

// for debugging
export const nodesByPath = new Map<String, TreeNode<any>[]>();

export function PathSegmentsAreValid(pathSegments: string[]) {
	return pathSegments.every(a=>a != null && a.trim().length > 0);
}

export type Doc_Base = {id: string, extras: object};

export class TreeNode<DataShape extends Doc_Base> {
	constructor(graph: Graphlink<any, any>, pathOrSegments: string | string[]) {
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
		this.path = PathOrPathGetterToPath(pathOrSegments)!;
		const queryStr = this.pathSegments.slice(-1)[0]?.startsWith("@query:") ? this.pathSegments.slice(-1)[0].slice("@query:".length) : null;
		this.pathSegments_noQuery = this.pathSegments.filter(a=>!a.startsWith("@query:"));
		this.path_noQuery = this.pathSegments_noQuery.join("/");
		Assert(PathSegmentsAreValid(this.pathSegments), `Path segments cannot be null/empty. @pathSegments(${this.pathSegments})`);
		this.type = GetTreeNodeTypeForPath(this.pathSegments);
		this.query_raw = queryStr ? QueryParams.ParseString(queryStr) : new QueryParams();
		// this.query gets set later, within the SubscribeIfNotAlready function (since the async entry-cache may need to be accessed for it)

		// only do these checks in dev-mode, since causes memory usage to keep going up (due to the map never being cleared)
		if (globalThis.DEV_DYN) {
			const oldNodesOnPath = nodesByPath.get(this.path) ?? [];
			//Assert(oldNodesOnPath.length == 0, `Found another TreeNode with the exact same path! @path:${this.path}`);
			AssertWarn(oldNodesOnPath.filter(a=>a.self_subscription != null).length == 0, `Found another TreeNode with the exact same path, with a live subscription! @path:${this.path}`);
			nodesByPath.set(this.path, oldNodesOnPath.concat(this));
		}

		this.countSecondsWithoutObserver_timer = new Timer(this.graph.options.unsubscribeTreeNodesAfter, ()=>{
			/*if (this.path_noQuery == "commandRuns/J5Vk5OYCRi-7tP6XtEBTQg") {
				let a = "test1";
			}
			console.log("At timer end... @path:", this.path, "@observedDataFields.size:", this.observedDataFields.size);*/

			// defensive; cancel unsubscribe if somehow we still have observers
			if (this.observedDataFields.size > 0) return;
			this.Unsubscribe();
			// todo: probably detach/completely-remove TreeNodes, in this case (to free up memory and such)
		}, 1);
		const OnDataFieldObservedStateChange = (field: string, newObservedState: boolean)=>{
			/*if (this.path_noQuery == "commandRuns/J5Vk5OYCRi-7tP6XtEBTQg") {
				let a = "test2";
			}*/

			if (newObservedState) {
				this.observedDataFields.add(field);
			} else {
				this.observedDataFields.delete(field);
			}
			//console.log("@path:", this.path, "@observedDataFields.size:", this.observedDataFields.size);

			if (this.observedDataFields.size == 0) {
				if (this.graph.options.unsubscribeTreeNodesAfter != -1) {
					this.countSecondsWithoutObserver_timer.Start();
				}
			} else {
				this.countSecondsWithoutObserver_timer.Stop();
				if (this.self_subscription == null) {
					RunInAction("TreeNode.OnDataFieldObservedStateChange.Resubscribe", ()=>{
						this.SubscribeIfNotAlready();
					});
				}
			}
		};
		onBecomeObserved(this, "Data_ForDirectSubscriber", ()=>OnDataFieldObservedStateChange("Data_ForDirectSubscriber", true));
		onBecomeUnobserved(this, "Data_ForDirectSubscriber", ()=>OnDataFieldObservedStateChange("Data_ForDirectSubscriber", false));
		onBecomeObserved(this, "DocDatas_ForDirectSubscriber", ()=>OnDataFieldObservedStateChange("DocDatas_ForDirectSubscriber", true));
		onBecomeUnobserved(this, "DocDatas_ForDirectSubscriber", ()=>OnDataFieldObservedStateChange("DocDatas_ForDirectSubscriber", false));
		// just because a TreeNode was created, does not mean anyone is actually mobx-observing it; so start the unsubscribe timer as soon as it's created
		if (this.graph.options.unsubscribeTreeNodesAfter != -1) {
			this.countSecondsWithoutObserver_timer.Start();
		}
	}
	observedDataFields = new Set<String>();
	countSecondsWithoutObserver_timer: Timer;
	// these are special proxies, that we use merely to keep track of if there are GetDoc/GetDocs calls still observing the given source-fields
	get Data_ForDirectSubscriber() { // [@computed]
		return this.PreferredData;
	}
	get DocDatas_ForDirectSubscriber() { // [@computed]
		return this.DocDatas;
	}

	graph: Graphlink<any, any>;
	pathSegments: string[];
	pathSegments_noQuery: string[];
	path: string;
	path_noQuery: string;
	type: TreeNodeType;

	get ParentNode() {
		return this.graph.tree.Get(this.pathSegments.slice(0, -1), false);
	}

	MarkRequested() {
		this.graph.treeRequestWatchers.forEach(a=>a.nodesRequested.add(this));
	}
	Request(subscribeIfNotAlready = true) {
		this.MarkRequested();
		if (subscribeIfNotAlready) {
			this.SubscribeIfNotAlready();
		}
	}
	private currentSubscribe_id?: string|n; // Why is this needed? Because if TreeNode.Unsubscribe() is called while a subscribe is still "progressing", that initial in-progress subscription needs to know when to self-cancel.
	/** Must be called from within a mobx action. (and not be run within a mobx computation) */
	SubscribeIfNotAlready() {
		Assert(MobX_AllowStateChanges(), "TreeNode.Subscribe cannot be run within a mobx computation.");
		Assert(this.type != TreeNodeType.Root, "Cannot subscribe to the tree root!");
		/*Assert(this.self_subscription == null, "Cannot subscribe more than once!");
		Assert(this.self_subscriptionStatus == SubscriptionStatus.Initial, `Cannot subscribe more than once! (subscription-status must be "Initial" at time of call to Subscribe)`);*/
		if (this.self_subscriptionStatus != SubscriptionStatus.Initial) return; // we only start subscribing now, if we haven't already started subscribing
		//if (this.self_subscription != null) return;
		Assert(this.self_subscription == null, `Subscription state marked as "Initial", yet self_subscription is not null! @path(${this.path})`);
		const thisSubscribe_id = GenerateUUID();
		this.currentSubscribe_id = thisSubscribe_id;
		const thisSubscribeActive = ()=>{
			//if (this.currentSubscribe_id != thisSubscribe_id) console.log("Not still active!", this.currentSubscribe_id, thisSubscribe_id, CE(this.pathSegments_noQuery).Last());
			return this.currentSubscribe_id == thisSubscribe_id;
		};

		RunInAction("TreeNode.Subscribe_prep", ()=>this.self_subscriptionStatus = SubscriptionStatus.PrepForSubscribe);

		(async()=>{
			if (!thisSubscribeActive()) return;
			const isCollectionType = this.type == TreeNodeType.Collection || this.type == TreeNodeType.CollectionQuery;
			const collectionNameOrDocID = CE(this.pathSegments_noQuery).Last();
			const cachedEntries = isCollectionType ? await entryCache.GetCachedEntries(collectionNameOrDocID) : {};
			if (!thisSubscribeActive()) return;

			// calculate the query_linked object, if it's not calculated yet, OR this tree-node is for a collection (these need to be recalculated each time, since the entry-cache may have changed)
			if (this.query == null || isCollectionType) {
				const newQuery = new QueryParams_Linked({...this.query_raw, treeNode: this});
				/*if (this.type != TreeNodeType.Root) {
					newQuery.treeNode = this;
					newQuery.CalculateDerivatives();
				}*/
				if (this.type == TreeNodeType.Document) {
					newQuery.varsDefine = ["$id: String!", newQuery.varsDefine].filter(a=>a).join(", ");
					//newQuery_linked.args_custom = {id: "$id"};
					newQuery.args_rawPrefixStr = ["id: $id", newQuery.args_rawPrefixStr].filter(a=>a).join(", ");
					newQuery.vars = E({id: collectionNameOrDocID}, newQuery.vars);
					newQuery.CalculateDerivatives();
				} else if (this.type == TreeNodeType.Collection || this.type == TreeNodeType.CollectionQuery) {
					newQuery.varsDefine = ["$cachedEntryHashes: JSONObject!", newQuery.varsDefine].filter(a=>a).join(", ");
					newQuery.args_rawPrefixStr = ["cachedEntryHashes: $cachedEntryHashes", newQuery.args_rawPrefixStr].filter(a=>a).join(", ");
					const cachedEntryHashes = CE(Object.entries(cachedEntries)).ToMapObj(a=>a[0], a=>a[1].hash);
					newQuery.vars = E({cachedEntryHashes}, newQuery.vars);
					newQuery.CalculateDerivatives();
				}
				this.query = newQuery;
			}

			RunInAction("TreeNode.Subscribe_prep", ()=>this.self_subscriptionStatus = SubscriptionStatus.WaitingForSubscribeComplete);
			MaybeLog_Base(a=>a.subscriptions, l=>l(`Subscribing to: ${this.path}`));
			if (this.type == TreeNodeType.Document) {
				this.self_apolloObservable = this.graph.subs.apollo.subscribe({
					query: this.query.GraphQLQuery(),
					variables: this.query.vars,
				});
				this.self_subscription = this.self_apolloObservable.subscribe({
					next: data=>{
						if (!thisSubscribeActive()) return;
						const returnedData = data.data; // if requested from top-level-query "map", data.data will have shape: {map: {...}}
						//const returnedDocument = returnedData[Object.keys(this.query.vars!)[0]]; // so unwrap it here
						Assert(Object.values(returnedData).length == 1);

						const returnedDocument_raw = Object.values(returnedData)[0] as Doc_Base|null; // so unwrap it here
						NormalizeDocumentShape(returnedDocument_raw, this.query!.DocSchemaName, this.graph.introspector);
						const returnedDocument = returnedDocument_raw as DataShape|null;

						MaybeLog_Base(a=>a.subscriptions, l=>l(`Got doc snapshot. @path(${this.path}) @snapshot:`, returnedDocument));
						this.graph.commitScheduler.ScheduleDataUpdateCommit(()=>{
							if (!thisSubscribeActive()) return;
							this.data_fromSelf.SetData(returnedDocument, false);
							this.self_subscriptionStatus = SubscriptionStatus.ReadyAndLive;
						});
					},
					error: err=>console.error("SubscriptionError:", err), // Does an error here mean the subscription is no longer valid? If so, we should probably unsubscribe->resubscribe.
					//complete: ()=>console.error("SubscriptionComplete."), // handling presumably useful, but oddly, neither "error" nor "complete" doesn't seem to trigger when server goes down
				});
			} else {
				this.self_apolloObservable = this.graph.subs.apollo.subscribe({
					query: this.query.GraphQLQuery(),
					variables: this.query.vars,
				});
				let lastSubscriptionResult_docIDs = [] as string[];
				this.self_subscription = this.self_apolloObservable.subscribe({
					next: data=>{
						if (!thisSubscribeActive()) return;
						const listChange = data.data[collectionNameOrDocID] as ListChange;
						Assert(listChange != null && listChange.data instanceof Array);

						//const prevDocs = this.DocDatas;
						//const nextDocs = prevDocs.slice();
						let addedOrChangedDocs = [] as DataShape[];
						let removedDocIDs = [] as string[];

						if (listChange.changeType == ListChangeType.FullList) {
							const existentDocs_outsideOfCache = listChange.data as DataShape[]; // if listChange.data is not an array, then something is wrong
							const existentDocs_withinCache = [] as DataShape[];

							// for each entry that the server returns (ie. says is new/changed from the hashes we sent), store the new/changed value in the entry-cache
							const newOrChangedDocs_cacheEntries = existentDocs_outsideOfCache.map(doc=>{
								const hash = listChange.hashes[doc.id];
								Assert(hash != null, `Expected to find hash for docID "${doc.id}", but didn't. @path(${this.path})`);
								return {
									docId: doc.id,
									data: doc,
									hash,
								} as CachedEntry_Core;
							});
							// we don't need to await this; if a future subscribe gets an incomplete entry-cache (unlikely), it's still not an actual problem (since the entry-cache is just a performance optimization)
							entryCache.UpdateTableEntries(collectionNameOrDocID, newOrChangedDocs_cacheEntries);

							for (const [docID, hash] of Object.entries(listChange.hashes)) {
								const doc_freshFromServer = existentDocs_outsideOfCache.find(a=>a.id == docID);
								// if the server omitted the data for this given entry, then it must be one of the entries we told the server we already had (ie. within cachedEntryHashes), so find it
								if (doc_freshFromServer == null) {
									const cacheEntryForDocID = cachedEntries[docID];
									Assert(cacheEntryForDocID != null, `Expected to find cache-entry for docID "${docID}", but didn't. @path(${this.path})`);
									existentDocs_withinCache.push(cacheEntryForDocID.data as DataShape);
								}
							}

							addedOrChangedDocs = [...existentDocs_withinCache, ...existentDocs_outsideOfCache];
							removedDocIDs = CE(lastSubscriptionResult_docIDs).Exclude(...addedOrChangedDocs.map(a=>a.id));
						} else if (listChange.changeType == ListChangeType.EntryAdded || listChange.changeType == ListChangeType.EntryChanged) {
							for (const addedOrChangedDoc of listChange.data) {
								addedOrChangedDocs.push(addedOrChangedDoc);
							}
						} else if (listChange.changeType == ListChangeType.EntryRemoved) {
							removedDocIDs.push(listChange.idOfRemoved);
						}

						const fromMemoryCache = false;

						MaybeLog_Base(a=>a.subscriptions, l=>l(`Got collection snapshot. @path(${this.path}) @addedOrChanged:`, addedOrChangedDocs.length, "@removed:", removedDocIDs.length));
						this.graph.commitScheduler.ScheduleDataUpdateCommit(()=>{
							if (!thisSubscribeActive()) return;
							let dataChanged = false;

							// for each doc in the new result-set, ensure a node exists for it, and set/update its "from parent" data
							for (const doc of addedOrChangedDocs) {
								if (!this.docNodes.has(doc.id)) {
									this.docNodes.set(doc.id, new TreeNode(this.graph, this.pathSegments.concat([doc.id])));
								}
								NormalizeDocumentShape(doc, this.query!.DocSchemaName, this.graph.introspector);
								//dataChanged = this.docNodes.get(doc.id)!.SetData(doc.data(), fromCache) || dataChanged;
								dataChanged = this.docNodes.get(doc.id)!.data_fromParent.SetData(Clone(doc), fromMemoryCache) || dataChanged;
							}

							// if docs are leaving the result set, remove those nodes from the tree
							for (const docID of removedDocIDs) {
								const docNode = this.docNodes.get(docID);
								dataChanged = docNode?.data_fromParent.SetData(null, fromMemoryCache) || dataChanged;

								// if this collection-subscription was the only reason the leaving-result-set doc's node was attached, remove that node from the tree (we don't want to detach nodes with active subscriptions)
								//if (docNode?.self_subscription == null) {

								//docNode?.Unsubscribe(); // commented; unsubscribe not really needed (doc leaves collection -> list-ui updates -> old child-ui leaves -> doc-node unsubscribes organically after delay)
								this.docNodes.delete(docID);
							}

							this.data_fromSelf.UpdateStatusAfterDataChange(dataChanged, fromMemoryCache);
							this.self_subscriptionStatus = SubscriptionStatus.ReadyAndLive;
							lastSubscriptionResult_docIDs = this.DocDatas.map(a=>a.id);
						});
					},
					error: err=>console.error("SubscriptionError:", err), // Does an error here mean the subscription is no longer valid? If so, we should probably unsubscribe->resubscribe.
					//complete: ()=>console.error("SubscriptionComplete."), // handling presumably useful, but oddly, neither "error" nor "complete" doesn't seem to trigger when server goes down
				});
			}
		})();
	}
	Unsubscribe(allowKeepDataCached = true) {
		//if (this.self_apolloObservable == null || this.self_subscription == null) return null;
		if (this.self_subscriptionStatus == SubscriptionStatus.Initial) return null;
		const {self_apolloObservable: self_apolloObservable_old, self_subscription: self_subscription_old} = this;

		this.self_apolloObservable = null;
		MaybeLog_Base(a=>a.subscriptions, l=>l(`Unsubscribing from: ${this.path}`));
		this.self_subscription?.unsubscribe();
		this.self_subscription = null;
		this.currentSubscribe_id = null; // reset currentSubscribe_id, so that if the subscribe we just "ended" still has events occur, it can self-cancel on seeing the id not match
		RunInAction("TreeNode.Unsubscribe", ()=>this.self_subscriptionStatus = SubscriptionStatus.Initial);
		this.data_fromSelf.NotifySubscriptionDropped(allowKeepDataCached);

		return {observable: self_apolloObservable_old, subscription: self_subscription_old};
	}
	UnsubscribeAll(allowKeepDataCached = true, nodesThatHadActiveOrInitializingSub: Set<TreeNode<any>> = new Set()) {
		if (this.self_subscriptionStatus != SubscriptionStatus.Initial) {
			nodesThatHadActiveOrInitializingSub.add(this);
		}
		this.Unsubscribe(allowKeepDataCached);
		this.collectionNodes.forEach(a=>a.UnsubscribeAll(allowKeepDataCached, nodesThatHadActiveOrInitializingSub));
		this.queryNodes.forEach(a=>a.UnsubscribeAll(allowKeepDataCached, nodesThatHadActiveOrInitializingSub));
		this.docNodes.forEach(a=>a.UnsubscribeAll(allowKeepDataCached, nodesThatHadActiveOrInitializingSub));
		return nodesThatHadActiveOrInitializingSub;
	}

	// data
	// ==========

	// these fields are only related to data_fromSelf (not data_fromParent)
	self_subscriptionStatus = SubscriptionStatus.Initial; // [@O]
	self_apolloObservable: Observable<FetchResult<any, Record<string, any>, Record<string, any>>>|null;
	self_subscription: ObservableSubscription|null;

	data_fromParent = new TreeNodeData<DataShape>();
	data_fromSelf = new TreeNodeData<DataShape>();
	get PreferredDataContainer() { // [@computed]
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
	get PreferredData() { // [@computed]
		return this.PreferredDataContainer.data;
	}
	/*SetData(data: DataShape, fromCache: boolean, containerField: "data_fromParent" | "data_fromSelf") {
		let container = containerField == "data_fromParent" ? this.data_fromParent : this.data_fromSelf;
		return container.SetData(data, fromCache);
	}*/

	get DocDatas() { // [@computed]
		//let docNodes = Array.from(this.docNodes.values()).filter(a=>a.status_forDirectSubscription == DataStatus.Received_Full && a.data != null);
		//let docNodes = Array.from(this.docNodes.values()).filter(a=>a.IsDataAcceptableToConsume(true));
		// for collections, we need to filter out nodes that were found (or at least requested) at some point, but whose data is now null (collections should never have null items)
		const docNodes = Array.from<TreeNode<any>>(this.docNodes.values()).filter(a=>a.data_fromParent.data != null);
		const docDatas = docNodes.map(docNode=>docNode.data_fromParent.data);
		//let docDatas = observable.array(docNodes.map(docNode=>docNode.data));
		return docDatas;
	}

	// hierarchy
	// ==========

	// for doc (and root) nodes
	collectionNodes = observable.map<string, TreeNode<any>>(); // [@O]
	//collectionNodes = new Map<string, TreeNode<any>>();

	// for collection (and collection-query) nodes
	queryNodes = observable.map<string, TreeNode<any>>(); // [@O] for collection nodes
	//queryNodes = new Map<string, TreeNode<any>>(); // for collection nodes
	query_raw: QueryParams; // for collection-query nodes; set in TreeNode constructor
	query: QueryParams_Linked|n; // for collection-query nodes; set in SubscribeIfNotAlready function
	docNodes = observable.map<string, TreeNode<any>>(); // [@O]
	//docNodes = new Map<string, TreeNode<any>>();

	get AllChildNodes(): TreeNode<any>[] {
		return [
			...this.collectionNodes.values(),
			...this.queryNodes.values(),
			...this.docNodes.values(),
		];
	}
	get AllDescendantNodes(): TreeNode<any>[] {
		return CE(this.AllChildNodes).SelectMany(a=>a.AllDescendantNodes);
	}

	// default createTreeNodesIfMissing to false, so that it's safe to call this from a computation (which includes store-accessors)
	Get(subpathOrGetterFunc: string | string[] | ((data: DataShape)=>any), createTreeNodesIfMissing: boolean): TreeNode<any>|null {
		const subpathSegments = PathOrPathGetterToPathSegments(subpathOrGetterFunc);

		const proceed_inAction = ()=>RunInAction(`TreeNode.Get @path(${this.path})`, ()=>proceed(true)); // cannot use DoX_ComputationSafe, since we need the return value
		//let proceed_inAction = ()=>DoX_ComputationSafe(`TreeNode.Get @path(${this.path})`, ()=>proceed(true));
		const proceed = (inAction: boolean)=>{
			let currentNode: TreeNode<any> = this;
			for (const [index, segment] of subpathSegments.entries()) {
				const subpathSegmentsToHere = subpathSegments.slice(0, index + 1);
				const childNodesPropName =
					segment.startsWith("@query:") ? "queryNodes" :
					currentNode.type == TreeNodeType.Collection ? "docNodes" :
					"collectionNodes";
				const childNodesMap = currentNode[childNodesPropName] as ObservableMap<string, TreeNode<any>>;
				const segmentAsMapKey = segment.startsWith("@query:") ? segment.slice("@query:".length) : segment;

				// if tree-node is non-existent, we have to either create it (if permitted), or abort
				if (!childNodesMap.has(segmentAsMapKey)) {
					if (!createTreeNodesIfMissing) return null; // if not permitted to create, abort
					if (!inAction) return proceed_inAction(); // if permitted to create, restart function in action (creation must be in action)
					//let pathToSegment = subpathSegments.slice(0, index).join("/");
					childNodesMap.set(segmentAsMapKey, new TreeNode(this.graph, this.pathSegments.concat(subpathSegmentsToHere)));
				}

				currentNode = childNodesMap.get(segmentAsMapKey)!;
			}
			return currentNode;
		};
		// first, try proceeding without runInAction 
		return proceed(false);
	}

	get raw() { return this.AsRawData(); } // helper for in console
	AsRawData(addTreeLink = true): DataShape {
		return TreeNodeToRawData(this, addTreeLink);
	}
	UploadRawData(rawData: DataShape) {
		// todo
	}
}

export function GetTreeNodeTypeForPath(pathOrSegments: string | string[]) {
	const pathSegments = PathOrPathGetterToPathSegments(pathOrSegments);
	if (pathSegments == null || pathSegments.length == 0) return TreeNodeType.Root;
	if (pathSegments.length == 1) return TreeNodeType.Collection;
	if (pathSegments.length == 2 || pathSegments.length == 3) {
		if (CE(pathSegments).Last().startsWith("@query:")) return TreeNodeType.CollectionQuery;
		return TreeNodeType.Document;
	}
	Assert(false, `Invalid TreeNode path. Cannot determine type. @path:${pathOrSegments}`);
	return null as any as TreeNodeType;
	//return pathSegments.length % 2 == 1 ? TreeNodeType.Collection : TreeNodeType.Document;
}
/*export function EnsurePathWatched(opt: FireOptions, path: string, filters?: Filter[]) {
	opt = E(defaultFireOptions, opt);
	let treeNode = opt.fire.tree.Get(path);
	if (treeNode.subscriptions.length) return;
	treeNode.Subscribe(filters ? new QueryParams({filters}) : null);
}*/

export function TreeNodeToRawData<DataShape extends Doc_Base>(treeNode: TreeNode<DataShape>, addTreeLink = true) {
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

	return result as DataShape;
}