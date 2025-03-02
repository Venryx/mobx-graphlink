import { gql } from "@apollo/client";
const gqlToGetFields = (key, depth_remaining) => {
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
export const introspectionQuery = gql `
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
    static GetFields(typeShape) {
        var _a, _b, _c;
        return (_c = (_a = typeShape.fields) !== null && _a !== void 0 ? _a : (_b = typeShape.ofType) === null || _b === void 0 ? void 0 : _b.fields) !== null && _c !== void 0 ? _c : [];
    }
    static GetInputFields(typeShape) {
        var _a, _b, _c;
        return (_c = (_a = typeShape.inputFields) !== null && _a !== void 0 ? _a : (_b = typeShape.ofType) === null || _b === void 0 ? void 0 : _b.inputFields) !== null && _c !== void 0 ? _c : [];
    }
}
export class GQLFieldShape {
}
export class GQLIntrospector {
    constructor() {
        this.introspectionComplete = false;
        this.typeShapes = {};
    }
    TypeShape(typeName) {
        if (!this.introspectionComplete)
            throw new Error("Introspection not complete");
        return this.typeShapes[typeName.toLowerCase()];
    }
    async RetrieveTypeShapes(apollo) {
        const introspectionResponse = await apollo.query({ query: introspectionQuery });
        const types = introspectionResponse.data.__schema.types;
        for (const type of types) {
            this.typeShapes[type.name.toLowerCase()] = type;
        }
        this.introspectionComplete = true;
    }
}
