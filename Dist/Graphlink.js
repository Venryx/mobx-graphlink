import { TreeNode } from "./Tree/TreeNode";
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
        /*InitSubs() {
            // todo
            this.subs.apollo = null;
        }*/
        this.subs = {};
        this.treeRequestWatchers = new Set();
        if (initOptions) {
            this.Initialize(initOptions);
        }
    }
    Initialize(initOptions) {
        let { apollo, rootStore } = initOptions;
        Graphlink.instances.push(this);
        this.rootStore = rootStore;
        //if (initSubs) {
        //this.InitSubs();
        this.subs.apollo = apollo;
        this.tree = new TreeNode(this, []);
        this.initialized = true;
    }
    //pathSubscriptions: Map<string, PathSubscription>;
    UnsubscribeAll() {
        this.tree.UnsubscribeAll();
    }
}
Graphlink.instances = [];
