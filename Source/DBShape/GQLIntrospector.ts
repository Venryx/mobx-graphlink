import {ApolloClient, NormalizedCacheObject, gql} from "@apollo/client";

const gqlToGetFields = (key: "fields" | "inputFields", depth_remaining: number)=>{
	const recurseResult = depth_remaining > 0 ? gqlToGetFields(key, depth_remaining - 1) : "";
	return `
		${key} {
			name
			type {
				name
				kind
				${recurseResult}

				${"" /* If field is non-null, then the "actual type" is within the ofType wrapper. */}
				ofType {
					name
					kind
					${recurseResult}
				}
			}
		}
	`;
};

export const introspectionQuery = gql`
	query {
		__schema {
			types {
				name
				description
				${gqlToGetFields("fields", 2)}
				${gqlToGetFields("inputFields", 2)}
			}
		}
	}
`;

/**
	TypeScript class reprsenting the data returned from an introspection query. (see `introspectionQuery`, exported from mobx-graphlink, with its code in `GQLIntrospector.ts`)
*/
export class GQLTypeShape {
	static GetFields(typeShape: GQLTypeShape) {
		return typeShape.fields ?? typeShape.ofType?.fields ?? [];
	}
	static GetInputFields(typeShape: GQLTypeShape) {
		return typeShape.inputFields ?? typeShape.ofType?.inputFields ?? [];
	}

	name: string;
	kind?: string;
	description?: string;
	ofType?: GQLTypeShape;

	fields?: GQLFieldShape[];
	inputFields?: GQLFieldShape[];
}
export class GQLFieldShape {
	name: string;
	type: GQLTypeShape;
}

export class GQLIntrospector {
	introspectionComplete = false;
	private typeShapes = {} as {[key: string]: GQLTypeShape};
	TypeShape(typeName: string) {
		if (!this.introspectionComplete) throw new Error("Introspection not complete");
		return this.typeShapes[typeName.toLowerCase()];
	}

	async RetrieveTypeShapes(apollo: ApolloClient<NormalizedCacheObject>) {
		const introspectionResponse = await apollo.query({query: introspectionQuery});
		const types = introspectionResponse.data.__schema.types;
		for (const type of types) {
			this.typeShapes[type.name.toLowerCase()] = type;
		}
		this.introspectionComplete = true;
	}
}