import { GetSchemaJSON } from "../Extensions/JSONSchemaHelpers.js";
/**
 * This function:
 * 1) Finds the list of "root fields" declared for this type, here on the client-side.
 * 2) Checks if the gql-introspector has (server graphql schema) type-data for this object; if so, gets the list of "root fields" declared for this type, there on the server-side.
 * 3) For each root-field declared client-side that is missing server-side, reshape this document (as returned from the server) so that those fields are on the root of the object instead. (to match the client-side expected shape)
 */
export function NormalizeDocumentShape(doc, docTypeName, introspector) {
    var _a, _b;
    if (!introspector.introspectionComplete)
        return;
    if (doc == null)
        return;
    const docExtras = doc["extras"];
    if (docExtras == null)
        return;
    const rootFields_client = Object.keys(GetSchemaJSON(docTypeName).properties);
    const rootFields_server_base = (_a = introspector.TypeShape(docTypeName)) === null || _a === void 0 ? void 0 : _a.fields;
    if (rootFields_server_base == null)
        return;
    const rootFields_server = (_b = rootFields_server_base.map(a => a.name)) !== null && _b !== void 0 ? _b : [];
    for (const fieldToRelocate of rootFields_client.filter(a => !rootFields_server.includes(a))) {
        const fieldData = docExtras[fieldToRelocate];
        doc[fieldToRelocate] = fieldData;
        delete docExtras[fieldToRelocate];
    }
}
