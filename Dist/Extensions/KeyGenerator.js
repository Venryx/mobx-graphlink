import { CE } from "js-vextensions";
import { slugid_v4 } from "./KeyGenerator_LL.js";
export const UUID_regex_partial = "[A-Za-z0-9_-]{22}";
export const UUID_regex = `^${UUID_regex_partial}$`;
//AddSchema("UUID", {type: "string", pattern: UUID_regex}); // moved to "SchemaHelpers.ts" file, so this file can be imported standalone
// we display the first 2 chars of UUIDs in various places, so try to avoid unpleasant character-combos for it
const unpleasant2Chars = ["fu", "pp"];
//let unpleasant4Chars = [];
export const generatedUUIDHistory = [];
/** Helper, eg. for if creating a db-seed file, and you need to reference the ID of the previous entry within an array literal. */
export function LastUUID(indexAdjustment = 0) {
    return generatedUUIDHistory[(generatedUUIDHistory.length - 1) + indexAdjustment];
}
export function GenerateUUID(avoidUnpleasantStartChars = true) {
    //return uuidV4(options);
    let result = slugid_v4();
    if (avoidUnpleasantStartChars) {
        while (CE(unpleasant2Chars).Contains(result.toLowerCase().slice(0, 2))) {
            result = slugid_v4();
        }
    }
    generatedUUIDHistory.push(result);
    return result;
}
