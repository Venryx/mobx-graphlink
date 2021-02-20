import { Graphlink } from "../Graphlink";
import { TreeNode } from "./TreeNode";
export declare class TreeRequestWatcher {
    constructor(graph: Graphlink<any, any>);
    graph: Graphlink<any, any>;
    Start(): void;
    Stop(): void;
    nodesRequested: Set<TreeNode<any>>;
}
