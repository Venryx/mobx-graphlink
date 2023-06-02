import {Timer} from "js-vextensions";
import {Graphlink} from "../Graphlink.js";
import {RunInAction} from "../Utils/General/MobX.js";

export class DataCommitScheduler {
	constructor(graph: Graphlink<any, any>) {
		this.graph = graph;
	}

	graph: Graphlink<any, any>;

	scheduledCommit_status = "inactive" as "inactive" | "collecting" | "committing";
	scheduledCommit_collectionStartTime = 0;
	scheduledCommit_commitFuncs = [] as Function[];
	scheduledCommit_waitTimer: Timer;
	//lastCommitTime = 0;
	
	ScheduleDataUpdateCommit(commitFunc: Function) {
		// if we are starting a new buffered commit, mark the commit-func-collection start-time
		if (this.scheduledCommit_status == "inactive") {
			this.scheduledCommit_status = "collecting";
			this.scheduledCommit_collectionStartTime = Date.now();
		}
		// if a commit was already scheduled, simply stop it (we'll restart the timer in a moment)
		//else if (this.scheduledCommit_waitTimer?.Enabled) { // not ideal, since if a commit-func schedules further calls to this, this check will falsely think a commit is still scheduled
		else if (this.scheduledCommit_status == "collecting") {
			this.scheduledCommit_waitTimer.Stop();
		}
		// else, we must be in the middle of committing a set of commit-funcs; just add current commit-func to list being committed, and then immediately return (since list already being processed)
		else {
			this.scheduledCommit_commitFuncs.push(commitFunc);
			return;
		}

		this.scheduledCommit_commitFuncs.push(commitFunc);

		const timeCollectingSoFar = Date.now() - this.scheduledCommit_collectionStartTime;
		const commitAtEndOfCallStack = timeCollectingSoFar > this.graph.options.dataUpdateBuffering_maxWait;
		const timerDelay = commitAtEndOfCallStack ? 0 : this.graph.options.dataUpdateBuffering_minWait;

		this.scheduledCommit_waitTimer = new Timer(timerDelay, ()=>{
			this.scheduledCommit_status = "committing";
			/*const commitFuncsLeftToRun = this.scheduledCommit_commitFuncs.slice();
			this.scheduledCommit_commitFuncs.length = 0;*/

			// call the actual commit-funcs
			const ProceedWithCommitting = ()=>{
				RunInAction("DataCommitScheduler.commit", ()=>{
					const commitStartTimeForSubset = Date.now();
					while (this.scheduledCommit_commitFuncs.length > 0) {
						const func = this.scheduledCommit_commitFuncs.shift()!;
						func();
						if (Date.now() - commitStartTimeForSubset > this.graph.options.dataUpdateBuffering_breakApartCommitSetsLongerThan) {
							break;
						}
					}

					// if we haven't run all the commit-funcs yet, schedule the next subset to run in a moment
					if (this.scheduledCommit_commitFuncs.length > 0) {
						setTimeout(ProceedWithCommitting, 0);
					} else {
						this.scheduledCommit_status = "inactive";
					}
				});
			};
			ProceedWithCommitting();

			//this.lastCommitTime = Date.now();
		}, 1);
		this.scheduledCommit_waitTimer.Start();
	}
}