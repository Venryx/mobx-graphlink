import {DataStatus, nodesByPath, TreeNode} from "./Tree/TreeNode.js";
import {TreeRequestWatcher} from "./Tree/TreeRequestWatcher.js";
import {PathOrPathGetterToPath, PathOrPathGetterToPathSegments} from "./Utils/DB/DBPaths.js";
import {makeObservable, observable, runInAction} from "mobx";
import type {Pool} from "pg";
import type Knex from "knex";
import {AccessorMetadata} from "./Accessors/@AccessorMetadata.js";
import {ApolloClient, NormalizedCacheObject} from "./Utils/@NPMFixes/apollo_client.js";
import {AccessorCallPlan} from "./Accessors/@AccessorCallPlan.js";
import {makeObservable_safe} from "./Utils/General/MobX.js";

export let defaultGraphOptions: GraphOptions;
export function SetDefaultGraphOptions(opt: GraphOptions) {
	defaultGraphOptions = opt;
}
export interface GraphOptions<StoreShape = any, DBShape = any> {
	graph: Graphlink<StoreShape, DBShape>;
}

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
	pgPool?: Pool;
}

export class Graphlink<StoreShape, DBShape> {
	static instances = [] as Graphlink<any, any>[];

	constructor(initOptions?: GraphlinkInitOptions<StoreShape>) {
		makeObservable_safe(this, {
			userInfo: observable,
	 	});
		if (initOptions) {
			this.Initialize(initOptions);
		}
	}

	initialized = false;
	Initialize(initOptions: GraphlinkInitOptions<StoreShape>) {
		let {rootStore, apollo, onServer, knexModule, pgPool} = initOptions;

		Graphlink.instances.push(this);
		this.rootStore = rootStore;
		//if (initSubs) {
		//this.InitSubs();
		this.onServer = onServer;
		this.subs.apollo = apollo;
		this.subs.knexModule = knexModule;
		this.subs.pgPool = pgPool;
		this.unsubscribeTreeNodesAfter = initOptions.unsubscribeTreeNodesAfter ?? 5000;

		this.tree = new TreeNode(this, []);
		
		this.initialized = true;
	}

	rootStore: StoreShape;
	storeOverridesStack = [] as StoreShape[];
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
		pgPool?: Pool|null; // only used if on db-server
	};
	unsubscribeTreeNodesAfter: number;

	readonly userInfo: UserInfo|null = null; // [@O]
	SetUserInfo(userInfo: UserInfo, clearCaches = true) {
		(this as any).userInfo = userInfo;
		if (clearCaches) {
			console.log("Clearing mobx-graphlink and apollo cache, due to user-info change.");
			return this.ClearCaches();
		}
	}
	async ClearCaches() {
		/*for (const node of this.tree.AllDescendantNodes) {
			node.data
		}*/
		// first, unsubscribe everything; this lets the server release the old live-queries
		this.tree.UnsubscribeAll();
		nodesByPath.clear(); // also clear this (debugging collection to track if multiple nodes are created for same path); tree is resetting, so reset this list too
		// then, delete/detach all the collection tree-nodes; this is equivalent to clearing the mobx-graphlink cache
		for (const [key, collectionNode] of this.tree.collectionNodes) {
			this.tree.collectionNodes.delete(key);
		}

		await this.subs.apollo.cache.reset();
		await this.subs.apollo.clearStore();
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
			nodesWithRequestedSubscriptions: this.NodesWhere(a=>a.status != DataStatus.Initial).length,
			nodesWithFulfilledSubscriptions: this.NodesWhere(a=>a.status == DataStatus.Received_Cache || a.status == DataStatus.Received_Full).length,
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