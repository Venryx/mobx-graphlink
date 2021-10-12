import {CE} from "js-vextensions";
import {GetAccessorMetadatas} from "./ConsoleHelpers.js";

globalThis.mglDevTools_hook = CreateMGLDevToolsHook();
function CreateMGLDevToolsHook() {
	const result = {
		GetAccessorMetadatas() {
			return GetAccessorMetadatas().map(meta=>{
				const result = CE(meta).IncludeKeys("name", "profilingInfo", "madeRawDBAccess", "callPlansStored", "callPlanMetas");
				result.callPlanMetas = CE(result.callPlanMetas).OrderByDescending(a=>a.profilingInfo.runTime_sum + a.profilingInfo.waitTime_sum);
				return result;
			});
		},
	};
	return result;
}