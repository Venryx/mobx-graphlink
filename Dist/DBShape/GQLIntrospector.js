import { gql } from "@apollo/client";
export const introspectionQuery = gql `
	query {
		__schema {
			types {
				name
				description
				fields {
					name
					type {
						name
						kind
						ofType {
							name
							kind
						}
					}
				}
			}
		}
	}
`;
/**
    TypeScript class reprsenting the data returned from an introspection query. (see `introspectionQuery`, exported from mobx-graphlink, with its code in `GQLIntrospector.ts`)
*/
export class GQLTypeShape {
}
export class GQLFieldShape {
}
export class GQLIntrospector {
    constructor() {
        this.introspectionComplete = false;
        this.typeShapes = {};
    }
    async RetrieveTypeShapes(apollo) {
        const introspectionResponse = await apollo.query({ query: introspectionQuery });
        const types = introspectionResponse.data.__schema.types;
        for (const type of types) {
            this.typeShapes[type.name] = type;
        }
        this.introspectionComplete = true;
    }
}
