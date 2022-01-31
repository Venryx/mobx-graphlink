import { TreeNode } from "./Tree/TreeNode.js";
import { observable } from "mobx";
import { makeObservable_safe } from "./Utils/General/MobX.js";
export let defaultGraphOptions;
export function SetDefaultGraphOptions(opt) {
    defaultGraphOptions = opt;
}
export class GraphlinkInitOptions {
}
export class Graphlink {
    constructor(initOptions) {
        this.initialized = false;
        this.storeOverridesStack = [];
        this.storeAccessorCachingTempDisabled = false;
        //accessorContext: AccessorContext<RootStoreShape> = new AccessorContext<RootStoreShape>(this);
        // call-stack stuff
        //lastRunAccessor_meta: AccessorMetadata|undefined;
        //currentDeepestCallPlanActive: AccessorCallPlan;
        // only use this for determining the "current deepest call-plan"; cannot construct a true/traditional "call-stack" since mobx-based "call-stacks" can trigger either top-down or bottom-up
        this.callPlan_callStack = [];
        this.subs = {};
        this.userInfo = null; // [@O]
        this.treeRequestWatchers = new Set();
        makeObservable_safe(this, {
            userInfo: observable,
        });
        if (initOptions) {
            this.Initialize(initOptions);
        }
    }
    Initialize(initOptions) {
        let { rootStore, apollo, onServer, knexModule, pgPool } = initOptions;
        Graphlink.instances.push(this);
        this.rootStore = rootStore;
        //if (initSubs) {
        //this.InitSubs();
        this.onServer = onServer;
        this.subs.apollo = apollo;
        this.subs.knexModule = knexModule;
        this.subs.pgPool = pgPool;
        this.tree = new TreeNode(this, []);
        this.initialized = true;
    }
    GetDeepestCallPlanCurrentlyRunning() {
        return this.callPlan_callStack[this.callPlan_callStack.length - 1];
    }
    SetUserInfo(userInfo, clearCaches = true) {
        this.userInfo = userInfo;
        if (clearCaches) {
            console.log("Clearing mobx-graphlink and apollo cache, due to user-info change.");
            return this.ClearCaches();
        }
    }
    async ClearCaches() {
        /*for (const node of this.tree.AllDescendantNodes) {
            node.data
        }*/
        // delete all the collection tree-nodes; this is equivalent to clearing the mobx-graphlink cache
        for (const [key, collectionNode] of this.tree.collectionNodes) {
            this.tree.collectionNodes.delete(key);
        }
        await this.subs.apollo.cache.reset();
        await this.subs.apollo.clearStore();
    }
    //pathSubscriptions: Map<string, PathSubscription>;
    UnsubscribeAll() {
        this.tree.UnsubscribeAll();
    }
}
Graphlink.instances = [];
export class UserInfo {
}
