import { CE } from "js-vextensions";
import { GetAccessorMetadatas } from "./ConsoleHelpers.js";
globalThis.mglDevTools_hook = CreateMGLDevToolsHook();
function CreateMGLDevToolsHook() {
    const result = {
        GetAccessorMetadatas() {
            return GetAccessorMetadatas().map(meta => {
                const result2 = CE(meta).IncludeKeys("name", "profilingInfo", "madeRawDBAccess", "callPlansCreated", "callPlanMetas");
                result2.callPlanMetas = CE(result2.callPlanMetas).OrderByDescending(a => a.profilingInfo.runTime_sum + a.profilingInfo.waitTime_sum);
                return result2;
            });
        },
    };
    return result;
}
