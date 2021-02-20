export class TreeRequestWatcher {
    constructor(graph) {
        this.nodesRequested = new Set();
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
