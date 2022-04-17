import {Assert} from "js-vextensions";
import {Graphlink, GraphOptions} from "../Graphlink.js";
import {TreeNode} from "./TreeNode.js";

export class TreeRequestWatcher {
	constructor(graph: Graphlink<any ,any>) {
		Assert(graph, "Graphlink instance must exist before creating TreeRequestWatchers.");
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

	nodesRequested = new Set<TreeNode<any> | TreeNodePlaceholder>();
}
export class TreeNodePlaceholder {
	_note = "This is a placeholder; data is still loading, but its tree-node hasn't been created yet, so this is its placeholder.";
}

/*export function CreateTreeAccessWatcher(opt: FireOptions) {
	let watcher = new TreeAccessWatcher(opt.fire);
	opt.fire.treeAccessWatchers.push(watcher);
}*/