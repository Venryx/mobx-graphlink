import {ApolloClient, NormalizedCacheObject, gql} from "@apollo/client";

export const introspectionQuery = gql`
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
	name: string;
	kind?: string;
	description?: string;
	fields?: GQLFieldShape[];
}
export class GQLFieldShape {
	name: string;
	type: GQLTypeShape;
}

export class GQLIntrospector {
	introspectionComplete = false;
	typeShapes = {} as {[key: string]: GQLTypeShape};

	async RetrieveTypeShapes(apollo: ApolloClient<NormalizedCacheObject>) {
		const introspectionResponse = await apollo.query({query: introspectionQuery});
		const types = introspectionResponse.data.__schema.types;
		for (const type of types) {
			this.typeShapes[type.name] = type;
		}
		this.introspectionComplete = true;
	}
}