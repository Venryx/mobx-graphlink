import { Assert } from "js-vextensions";
export class TreeRequestWatcher {
    constructor(graph) {
        Object.defineProperty(this, "graph", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "nodesRequested", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
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
