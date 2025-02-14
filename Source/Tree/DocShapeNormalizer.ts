import {GQLIntrospector} from "../DBShape/GQLIntrospector.js";
import {GetSchemaJSON} from "../Extensions/JSONSchemaHelpers.js";

/**
 * This function:
 * 1) Finds the list of "root fields" declared for this type, here on the client-side.
 * 2) Checks if the gql-introspector has (server graphql schema) type-data for this object; if so, gets the list of "root fields" declared for this type, there on the server-side.
 * 3) For each root-field declared client-side that is missing server-side, reshape this document (as returned from the server) so that those fields are on the root of the object instead. (to match the client-side expected shape)
 */
export function NormalizeDocumentShape(doc: object, docTypeName: string, introspector: GQLIntrospector) {
	if (!introspector.introspectionComplete) return;
	const docExtras = doc["extras"] as {[key: string]: any};
	if (docExtras == null) return;

	const rootFields_client = Object.keys(GetSchemaJSON(docTypeName).properties!);
	const rootFields_server_base = introspector.typeShapes[docTypeName]?.fields;
	if (rootFields_server_base == null) return;
	const rootFields_server = rootFields_server_base.map(a=>a.name) ?? [];

	for (const fieldToRelocate of rootFields_client.filter(a=>!rootFields_server.includes(a))) {
		const fieldData = docExtras[fieldToRelocate];
		doc[fieldToRelocate] = fieldData;
		delete docExtras[fieldToRelocate];
	}
}