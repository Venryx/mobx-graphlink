import {TreeNode} from "./Tree/TreeNode.js";
import {TreeRequestWatcher} from "./Tree/TreeRequestWatcher.js";
import {PathOrPathGetterToPath, PathOrPathGetterToPathSegments} from "./Utils/DB/DBPaths.js";
import {observable, runInAction} from "mobx";
import {ApolloClient, NormalizedCacheObject} from "@apollo/client/core/index.js";
import type {PoolClient} from "pg";
import type Knex from "knex";
import {AccessorMetadata} from "./Accessors/@AccessorMetadata.js";

export let defaultGraphOptions: GraphOptions;
export function SetDefaultGraphOptions(opt: GraphOptions) {
	defaultGraphOptions = opt;
}
export interface GraphOptions<RootStoreShape = any, DBShape = any> {
	graph: Graphlink<RootStoreShape, DBShape>;
}

export class GraphlinkInitOptions<RootStoreShape> {
	rootStore: RootStoreShape;
	apollo: ApolloClient<NormalizedCacheObject>;
	knexModule?: typeof Knex;
	pgClient?: PoolClient;
	//initSubs = true;
}

export class Graphlink<RootStoreShape, DBShape> {
	static instances = [] as Graphlink<any, any>[];

	constructor(initOptions?: GraphlinkInitOptions<RootStoreShape>) {
		if (initOptions) {
			this.Initialize(initOptions);
		}
	}

	initialized = false;
	Initialize(initOptions: GraphlinkInitOptions<RootStoreShape>) {
		let {rootStore, apollo, knexModule, pgClient} = initOptions;

		Graphlink.instances.push(this);
		this.rootStore = rootStore;
		//if (initSubs) {
		//this.InitSubs();
		this.subs.apollo = apollo;
		this.subs.knexModule = knexModule;
		this.subs.pgClient = pgClient;
		this.tree = new TreeNode(this, []);
		
		this.initialized = true;
	}

	rootStore: RootStoreShape;
	storeOverridesStack = [] as RootStoreShape[];
	storeAccessorCachingTempDisabled = false;
	//accessorContext: AccessorContext<RootStoreShape> = new AccessorContext<RootStoreShape>(this);
	lastRunAccessor_meta: AccessorMetadata|undefined;

	/*InitSubs() {
		// todo
		this.subs.apollo = null;
	}*/
	subs = {} as {
		apollo: ApolloClient<NormalizedCacheObject>;
		knexModule?: typeof Knex|null; // only used if on db-server
		pgClient?: PoolClient|null; // only used if on db-server
	};

	@observable userInfo: UserInfo|null;
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
}

export class UserInfo {
	id: string;
	//displayName: string;
}