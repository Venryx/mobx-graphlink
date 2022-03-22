import { ObjectCE } from "js-vextensions";
import { SplitStringBySlash_Cached } from "../../index.js";
/*export function IsAuthValid(auth) {
    return auth && !auth.isEmpty;
}*/
export const CleanType_values = ["hideField_typename", "hideField_underscore", "removeNullFields"];
export function CleanDBData(data, cleanTypes = CleanType_values.slice()) {
    if (data == null)
        return;
    //const dataHasGraphQLType = "__typename" in data;
    //const dataHasGraphQLType = Object.keys(data).includes("__typename");
    for (const [key, value] of Object.entries(data)) {
        if (key == "__typename" && cleanTypes.includes("hideField_typename")) {
            const typeName = data.__typename;
            delete data.__typename;
            Object.defineProperty(data, "__typename", { value: typeName }); // defining it this way, makes the property non-enumerable
        }
        else if (key == "_" && cleanTypes.includes("hideField_underscore")) {
            const typeName = data._;
            delete data._;
            Object.defineProperty(data, "_", { value: typeName }); // defining it this way, makes the property non-enumerable
        }
        else {
            // remove fields that are null; this works more smoothly with return-data schemas (where its easy to mark field as optional/omittable, but not as easy to mark as nullable)
            if (value == null) {
                if (cleanTypes.includes("removeNullFields")) {
                    delete data[key];
                }
            }
            // now that mobx-graphlink supports nested gql-types, we have to clean sub-objects as well (though only clean nested objects of the "__typename" field)
            else if (typeof value == "object" && cleanTypes.includes("hideField_typename")) {
                CleanDBData(value, ["hideField_typename"]);
            }
        }
    }
    return data;
}
export function ConvertDataToValidDBUpdates(versionPath, versionData, dbUpdatesRelativeToVersionPath = true) {
    const result = {};
    for (const { key: pathFromVersion, value: data } of ObjectCE(versionData).Pairs()) {
        const fullPath = `${versionPath}/${pathFromVersion}`;
        const pathForDBUpdates = dbUpdatesRelativeToVersionPath ? pathFromVersion : fullPath;
        // if entry`s "path" has odd number of segments (ie. points to collection), extract the children data into separate set-doc updates
        if (SplitStringBySlash_Cached(fullPath).length % 2 !== 0) {
            for (const { key, value } of ObjectCE(data).Pairs()) {
                result[`${pathForDBUpdates}/${key}`] = value;
            }
        }
        else {
            result[pathForDBUpdates] = data;
        }
    }
    return result;
}
