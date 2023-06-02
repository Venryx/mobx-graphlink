import {nodesByPath, SubscriptionStatus, TreeNode} from "./Tree/TreeNode.js";
import {TreeRequestWatcher} from "./Tree/TreeRequestWatcher.js";
import {makeObservable, observable, runInAction} from "mobx";
import type Knex from "knex";
import {ApolloClient, NormalizedCacheObject} from "@apollo/client";
import {AccessorCallPlan} from "./Accessors/@AccessorCallPlan.js";
import {makeObservable_safe, RunInAction} from "./Utils/General/MobX.js";
import {Assert} from "js-vextensions";
import {DataCommitScheduler} from "./Components/DataCommitScheduler.js";

export class GraphlinkInitOptions<StoreShape> {
	rootStore: StoreShape;
	apollo: ApolloClient<NormalizedCacheObject>;
	onServer: boolean;
	//initSubs = true;
	/**
	 * After X milliseconds of being unobserved, a TreeNode will unsubscribe its GraphQL subscription, by sending "stop" over the websocket.
	 * Special values: 5000 (default), -1 (never auto-unsubscribe)
	 * */
	unsubscribeTreeNodesAfter?: number;

	// server-specific
	knexModule?: typeof Knex;
	pgPool?: any; //Pool;
}

export class GraphlinkOptions {
	constructor(data?: Partial<GraphlinkOptions>) {
		Object.assign(this, data);
	}
	unsubscribeTreeNodesAfter = 5000;
	/** After each data-update, how long to wait for another data-update; if another occurs during this period, the timer is reset, and another wait occurs. (until max-wait is reached) */
	dataUpdateBuffering_minWait = 10;
	dataUpdateBuffering_maxWait = 100;
	dataUpdateBuffering_breakApartCommitSetsLongerThan = 1000;
}

export class Graphlink<StoreShape, DBShape> {
	static instances = [] as Graphlink<any, any>[];

	constructor(initOptions?: GraphlinkInitOptions<StoreShape>, options?: GraphlinkOptions) {
		makeObservable_safe(this, {
			userInfo: observable,
	 	});
		if (initOptions) {
			this.Initialize(initOptions, options);
		} else {
			Assert(options == null);
		}
	}

	initialized = false;
	Initialize(initOptions: GraphlinkInitOptions<StoreShape>, options?: GraphlinkOptions) {
		let {rootStore, apollo, onServer, knexModule, pgPool} = initOptions;

		Graphlink.instances.push(this);
		this.rootStore = rootStore;
		//if (initSubs) {
		//this.InitSubs();
		this.onServer = onServer;
		this.subs.apollo = apollo;
		this.subs.knexModule = knexModule;
		this.subs.pgPool = pgPool;
		this.options = options ?? new GraphlinkOptions();

		this.commitScheduler = new DataCommitScheduler(this);
		this.tree = new TreeNode(this, []);
		
		this.initialized = true;
	}

	rootStore: StoreShape;
	storeOverridesStack = [] as StoreShape[];
	/** Set this to false if you need to make sure all relevant database-requests within an accessor tree are being activated. */
	storeAccessorCachingTempDisabled = false;
	//accessorContext: AccessorContext<RootStoreShape> = new AccessorContext<RootStoreShape>(this);
	// call-stack stuff
	//lastRunAccessor_meta: AccessorMetadata|undefined;
	//currentDeepestCallPlanActive: AccessorCallPlan;
	// only use this for determining the "current deepest call-plan"; cannot construct a true/traditional "call-stack" since mobx-based "call-stacks" can trigger either top-down or bottom-up
	callPlan_callStack = [] as AccessorCallPlan[];
	GetDeepestCallPlanCurrentlyRunning() {
		return this.callPlan_callStack[this.callPlan_callStack.length - 1];
	}

	/*InitSubs() {
		// todo
		this.subs.apollo = null;
	}*/
	onServer: boolean;
	subs = {} as {
		apollo: ApolloClient<NormalizedCacheObject>;
		knexModule?: typeof Knex|null; // only used if on db-server
		//pgPool?: Pool|null; // only used if on db-server
		pgPool?: any|null; // only used if on db-server
	};
	options: GraphlinkOptions;

	readonly userInfo: UserInfo|null = null; // [@O]
	/** Can be called prior to Graphlink.Initialize(). */
	async SetUserInfo(userInfo: UserInfo|null, clearCaches = true, resubscribeAfter = true) {
		(this as any).userInfo = userInfo;
		if (clearCaches && this.initialized) {
			console.log("Clearing mobx-graphlink and apollo cache, due to user-info change.");
			let nodesThatHadActiveSubscription = await this.ClearCaches();
			if (resubscribeAfter) {
				RunInAction("SetUserInfo.resubscribeAfter", ()=>{
					for (const node of nodesThatHadActiveSubscription) {
						if (node.self_subscription == null) { // check, in case node was already resubscribed by an external caller
							node.Subscribe();
						}
					}
				});
			}
			return nodesThatHadActiveSubscription;
		}
	}
	async ClearCaches() {
		/*for (const node of this.tree.AllDescendantNodes) {
			node.data
		}*/
		// first, unsubscribe everything; this lets the server release the old live-queries
		let nodesThatHadActiveSubscription = this.tree.UnsubscribeAll(false);
		nodesByPath.clear(); // also clear this (debugging collection to track if multiple nodes are created for same path); tree is resetting, so reset this list too
		
		// then, delete/detach all the collection tree-nodes; this is equivalent to clearing the mobx-graphlink cache (well, cache should be cleared by `UnsubscribeAll(false)` above, but this makes certain)
		// commented; this causes issues in mobx-graphlink, where the old subtrees are still being observed (by the accessors), yet are disconnected from the new set created by new requests
		// todo: add asserts to avoid mistakes like this in the future (eg. by confirming that whenever processing is done for a TreeNode, it is still connected to the graphlink root)
		/*for (const [key, collectionNode] of this.tree.collectionNodes) {
			this.tree.collectionNodes.delete(key);
		}*/

		// clear the apollo-cache as well (since mobx-graphlink uses subscriptions exclusively, this probably isn't necessary, but we'll clear it anyway to be sure)
		await this.subs.apollo.cache.reset();
		await this.subs.apollo.clearStore();

		return nodesThatHadActiveSubscription;
	}
	// todo (probably)
	/*async LogIn() {
		// todo
		return null;
	}
	async LogIn_WithCredential() {
		// todo
		return null;
	}
	async LogOut() {
		// todo
	}*/

	commitScheduler: DataCommitScheduler;
	tree: TreeNode<DBShape>;
	treeRequestWatchers = new Set<TreeRequestWatcher>();
	//pathSubscriptions: Map<string, PathSubscription>;
	UnsubscribeAll() {
		this.tree.UnsubscribeAll();
	}

	ValidateDBData?: (dbData: DBShape)=>void;

	allTreeNodes = new Set<TreeNode<any>>();
	NodesWhere(filterFunc: (node: TreeNode<any>)=>boolean): TreeNode<any>[] {
		return [...this.allTreeNodes].filter(filterFunc);
	}
	// these are just stats that the consumer may be interested in
	GetStats(): GraphlinkStats {
		return new GraphlinkStats({
			attachedTreeNodes: this.allTreeNodes.size,
			nodesWithRequestedSubscriptions: this.NodesWhere(a=>a.self_subscriptionStatus != SubscriptionStatus.Initial).length,
			//nodesWithFulfilledSubscriptions: this.NodesWhere(a=>ObjectCE(a.PreferredDataContainer.status).IsOneOf(DataStatus.Received_Live, DataStatus.Received_CachedByMGL)).length,
			nodesWithFulfilledSubscriptions: this.NodesWhere(a=>a.self_subscriptionStatus == SubscriptionStatus.ReadyAndLive).length,
		});
	}
}

export class GraphlinkStats {
	constructor(data?: Partial<GraphlinkStats>) {
		Object.assign(this, data);
	}
	attachedTreeNodes: number;
	nodesWithRequestedSubscriptions: number;
	nodesWithFulfilledSubscriptions: number;
}

export class UserInfo {
	id: string;
	//displayName: string;
}

// graph-refs system (this is how the standalone functions are able to know which graph they're operating on)
// ==========

export let defaultGraphRefs: GraphRefs;
export function SetDefaultGraphRefs(opt: GraphRefs) {
	defaultGraphRefs = opt;
}
export interface GraphRefs<StoreShape = any, DBShape = any> {
	graph: Graphlink<StoreShape, DBShape>;
}