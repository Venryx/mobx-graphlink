import { ObjectCE, CE, Assert } from "js-vextensions";
import u from "updeep";
import { Command } from "../Server/Command.js";
export function MergeDBUpdates(baseUpdatesMap, updatesToMergeMap) {
    const baseUpdates = ObjectCE(baseUpdatesMap).Pairs().map(pair => ({ path: pair.key, data: pair.value }));
    const updatesToMerge = ObjectCE(updatesToMergeMap).Pairs().map(pair => ({ path: pair.key, data: pair.value }));
    for (const update of updatesToMerge) {
        //Assert(!(update.data instanceof Command_Old) && !(update.data instanceof Command), "You forgot to add the GetDBUpdates() method-call, ie: sub.GetDBUpdates().");
        Assert(!(update.data instanceof Command), "You forgot to add the GetDBUpdates() method-call, ie: sub.GetDBUpdates().");
        // if an update-to-merge exists for a path, remove any base-updates starting with that path (since the to-merge ones have priority)
        if (update.data == null) {
            for (const update2 of baseUpdates.slice()) { // make copy, since Remove() seems to break iteration otherwise
                if (update2.path.startsWith(update.path)) {
                    CE(baseUpdates).Remove(update2);
                }
            }
        }
    }
    const finalUpdates = [];
    for (const update of baseUpdates) {
        // find updates-to-merge where a field under this path is updated (collection-updates under this path are left alone since they're supposed to be separate updates)
        const updatesToMergeIntoThisOne = updatesToMerge.filter(update2 => update2.path.startsWith(`${update.path}/.`));
        for (const updateToMerge of updatesToMergeIntoThisOne) {
            const updateToMerge_relativePath = updateToMerge.path.substr(`${update.path}/`.length);
            // if (updateToMerge.data) {
            // assume that the update-to-merge has priority, so have it completely overwrite the data at its path
            update.data = u.updateIn(updateToMerge_relativePath.replace(/\//g, "."), u.constant(updateToMerge.data), update.data);
            /*} else {
                update.data = null;
            }*/
            // remove from updates-to-merge list (since we just merged it)
            CE(updatesToMerge).Remove(updateToMerge);
        }
        finalUpdates.push(update);
    }
    // for any "update to merge" which couldn't be merged into one of the base-updates, just add it as its own update (it won't clash with the others)
    for (const update of updatesToMerge) {
        finalUpdates.push(update);
    }
    const finalUpdatesMap = finalUpdates.reduce((result, current) => ObjectCE(result).VSet(current.path, current.data), {});
    return finalUpdatesMap;
}
export function MergeDBUpdates_Multi(...dbUpdateMaps) {
    let result = {};
    for (let dbUpdateMap of dbUpdateMaps) {
        result = MergeDBUpdates(result, dbUpdateMap);
    }
    return result;
}
