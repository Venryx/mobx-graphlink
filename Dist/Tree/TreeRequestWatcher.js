import { Assert } from "js-vextensions";
export class TreeRequestWatcher {
    constructor(graph) {
        this.nodesRequested = new Set();
        Assert(graph, "Graphlink instance must exist before creating TreeRequestWatchers.");
        this.graph = graph;
    }
    Start() {
        this.nodesRequested.clear();
        this.graph.treeRequestWatchers.add(this);
    }
    Stop() {
        this.graph.treeRequestWatchers.delete(this);
    }
}
/*export function CreateTreeAccessWatcher(opt: FireOptions) {
    let watcher = new TreeAccessWatcher(opt.fire);
    opt.fire.treeAccessWatchers.push(watcher);
}*/ 
