import { Timer } from "js-vextensions";
import { Graphlink } from "../Graphlink.js";
export declare class DataCommitScheduler {
    constructor(graph: Graphlink<any, any>);
    graph: Graphlink<any, any>;
    scheduledCommit_status: "inactive" | "collecting" | "committing";
    scheduledCommit_collectionStartTime: number;
    scheduledCommit_commitFuncs: Function[];
    scheduledCommit_waitTimer: Timer;
    ScheduleDataUpdateCommit(commitFunc: Function): void;
}
