import { GQLIntrospector } from "../DBShape/GQLIntrospector.js";
/**
 * This function:
 * 1) Finds the list of "root fields" declared for this type, here on the client-side.
 * 2) Checks if the gql-introspector has (server graphql schema) type-data for this object; if so, gets the list of "root fields" declared for this type, there on the server-side.
 * 3) For each root-field declared client-side that is missing server-side, reshape this document (as returned from the server) so that those fields are on the root of the object instead. (to match the client-side expected shape)
 */
export declare function NormalizeDocumentShape(doc: object, docTypeName: string, introspector: GQLIntrospector): void;
