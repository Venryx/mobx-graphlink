import {Firelink, FireOptions} from "../Graphlink";
import {TreeNode} from "./TreeNode";

export class TreeRequestWatcher {
	constructor(fire: Firelink<any ,any>) {
		this.fire = fire;
	}
	fire: Firelink<any ,any>;
	Start() {
		this.nodesRequested.clear();
		this.fire.treeRequestWatchers.add(this);
	}
	Stop() {
		this.fire.treeRequestWatchers.delete(this);
	}

	nodesRequested = new Set<TreeNode<any>>();
}

/*export function CreateTreeAccessWatcher(opt: FireOptions) {
	let watcher = new TreeAccessWatcher(opt.fire);
	opt.fire.treeAccessWatchers.push(watcher);
}*/