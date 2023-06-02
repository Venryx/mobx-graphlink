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
		// else, we must be in the middle of committing a set of commit-funcs; add current commit-func to the next list, but then immediately return (once current commit-set completes, it'll kick off a new set)
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
			const commitFuncsLeftToRun = this.scheduledCommit_commitFuncs.slice();
			this.scheduledCommit_commitFuncs.length = 0;

			// call the actual commit-funcs
			const ProceedWithCommitting = ()=>{
				// wrapping multiple commit-funcs in a single action is a nice idea, but the time-based throttling system doesn't really work then, since almost all the execution time is in running the reactions
				// we leave it like this for now though, opting instead to rely on the "dataUpdateBuffering_commitSetMaxFuncCount" option
				RunInAction("DataCommitScheduler.commit", ()=>{

				const commitStartTime = Date.now();
				let commitFuncsExecuted = 0;
				while (commitFuncsLeftToRun.length > 0) {
					const func = commitFuncsLeftToRun.shift()!;
					func();
					//RunInAction("DataCommitScheduler.commit", ()=>func());
					commitFuncsExecuted++;
					if (commitFuncsExecuted >= this.graph.options.dataUpdateBuffering_commitSetMaxFuncCount) {
						break;
					}
					if (Date.now() - commitStartTime > this.graph.options.dataUpdateBuffering_commitSetMaxTime) {
						break;
					}
				}

				// if we haven't run all the commit-funcs yet, schedule the next subset to run in a moment
				if (commitFuncsLeftToRun.length > 0) {
					setTimeout(ProceedWithCommitting, this.graph.options.dataUpdateBuffering_breakDuration);
				} else {
					this.scheduledCommit_status = "inactive";

					// there were commit-funcs that wanted in on this set, but had to wait; kick off a new set for them
					if (this.scheduledCommit_commitFuncs.length > 0) {
						this.ScheduleDataUpdateCommit(()=>{});
					}
				}

				});
			};
			ProceedWithCommitting();

			//this.lastCommitTime = Date.now();
		}, 1);
		this.scheduledCommit_waitTimer.Start();
	}
}