import {Graphlink, GraphOptions} from "../Graphlink.js";
import {TreeNode} from "./TreeNode.js";

export class TreeRequestWatcher {
	constructor(graph: Graphlink<any ,any>) {
		this.graph = graph;
	}
	graph: Graphlink<any ,any>;
	Start() {
		this.nodesRequested.clear();
		this.graph.treeRequestWatchers.add(this);
	}
	Stop() {
		this.graph.treeRequestWatchers.delete(this);
	}

	nodesRequested = new Set<TreeNode<any>>();
}

/*export function CreateTreeAccessWatcher(opt: FireOptions) {
	let watcher = new TreeAccessWatcher(opt.fire);
	opt.fire.treeAccessWatchers.push(watcher);
}*/