import React from "react";

export let hookUpdatesBlocked = false;
export function SetHookUpdatesBlocked(blocked: boolean) {
	hookUpdatesBlocked = blocked;
}

export class HookCallRecorder {
	hookCalls = [] as {hookFunc: string, args: any[]}[];
}
export const hookCallRecorders = new Set<HookCallRecorder>();

// NOTE: If additional intercepts are needed, and you're not sure which, replace the return-line of LoadingUIProxy with `return new Promise(()=>{});`, then observe the runtime error

export const useState_orig = React.useState;

export const React_origHookFuncs = {};
for (const [key, func_orig] of Object.entries(React)) {
	if (typeof func_orig == "function" && key.startsWith("use") && key !== "use") {
		React_origHookFuncs[key] = func_orig;

		let hookIntercept;
		/* eslint-disable no-loop-func */
		if (key == "useState") {
			hookIntercept = function useState_hookInterceptFromMobXGraphlink(...args): ReturnType<typeof React.useState> {
				hookCallRecorders.forEach(recorder=>recorder.hookCalls.push({hookFunc: key, args}));
				const [val, setVal_orig] = useState_orig.apply(this, args);

				// this could maybe work...
				if (hookUpdatesBlocked) {
					return [
						val,
						function setVal_noOpSinceHookUpdatesBlocked() {},
					];
				}
				return [val, setVal_orig];

				// but this is preferred, because the setVal function is stable then (ie. definitely won't cause invalidation of later useMemo calls and such)
				/*setVal_orig["interceptVersion"] ??= function setVal_intercept(...args) {
					if (hookUpdatesBlocked) return;
					return setVal_orig.apply(this, args);
				};
				return [
					val,
					setVal_orig["interceptVersion"],
				];*/
			};
		} else {
			hookIntercept = function hookInterceptFromMobXGraphlink(...args) {
				hookCallRecorders.forEach(recorder=>recorder.hookCalls.push({hookFunc: key, args}));
				return func_orig.apply(this, args);
			};
		}
		/* eslint-enable no-loop-func */

		React[key] = hookIntercept;
	}
}