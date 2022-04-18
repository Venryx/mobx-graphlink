import { Graphlink } from "../Graphlink.js";
import { TreeNode } from "./TreeNode.js";
export declare class TreeRequestWatcher {
    constructor(graph: Graphlink<any, any>);
    graph: Graphlink<any, any>;
    Start(): void;
    Stop(): void;
    nodesRequested: Set<TreeNode<any> | TreeNodePlaceholder>;
}
export declare class TreeNodePlaceholder {
    constructor(path: string);
    path: string;
    _note: string;
}
