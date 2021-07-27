import {ObjectCE, CE, Assert} from "js-vextensions";
import u from "updeep";
import {Command} from "../../Server/Command.js";
import {DBUpdate} from "./DBUpdate.js";

/*
Todo: Maybe expand the merging system to be able to merge "sibling-only" db-updates.
However, if you do so, make sure the code takes into account how the db-updates are applied...
For example:
```
dbUpdates = {
	"entries/1/.root1": 1,
	"entries/1/.root2": 2,
};
```
Make sure it does *not* return the below:
dbUpdates = {
	"entries/1": {
		"root1": 1,
		"root2": 2,
	},
};
...*unless* the application type is "merge".
*/

/*type Update = {path: string, data: any};
function FixDBUpdates(updatesMap) {
	let updates = updatesMap.Props().map(prop=>({path: prop.name, data: prop.value}));
	for (let update of updates) {
		let otherUpdatesToMergeIntoThisOne: Update[] = updates.filter(update2=> {
			return update2.path.startsWith(update.path);
		});
		for (let updateToMerge of otherUpdatesToMergeIntoThisOne) {
			delete updates[updateToMerge.path];

			let updateToMerge_relativePath = updateToMerge.path.substr(0, update.path.length);
			update.data = u.updateIn(updateToMerge_relativePath, constant(updateToMerge.data), update.data)
		}
	}
}*/
export function SimplifyDBUpdates(updates_orig: DBUpdate[]) {
	const updates = updates_orig.slice(); // make copy, in case caller wants to keep the full original array

	for (const update of updates.slice()) { // make another copy for iteration purposes (the main iterator is disrupted by Remove() calls)
		const earlierUpdates = updates.slice(0, updates.indexOf(update));
		const laterUpdates = updates.slice(updates.indexOf(update) + 1);

		// for updates superseded by a later update (due to path-overwriting), delete
		if (CE(laterUpdates).Any(laterUpdate=>update.path.startsWith(laterUpdate.path))) {
			CE(updates).Remove(update);
		}

		// for updates that "extend" an earlier update (eg. updating field within doc/row set earlier), merge the change into that earlier update
		const earlierSetContainingCurrentPath = earlierUpdates.find(a=>a.PathSegments.length < update.PathSegments.length && update.path.startsWith(a.path));
		if (earlierSetContainingCurrentPath) {
			const pathPortionToRemoveFromPathOfUpdateToMerge = `${earlierSetContainingCurrentPath.path}/`;
			Assert(update.path.startsWith(pathPortionToRemoveFromPathOfUpdateToMerge));

			// apply the merging
			const updateToMerge_relativePath = update.path.slice(pathPortionToRemoveFromPathOfUpdateToMerge.length);
			earlierSetContainingCurrentPath.value = u.updateIn(updateToMerge_relativePath.replace(/\//g, "."), u.constant(update.value), earlierSetContainingCurrentPath.value);

			// remove "extension" update from list (since we just merged it)
			CE(updates).Remove(update);
		}
	}
	return updates;
}