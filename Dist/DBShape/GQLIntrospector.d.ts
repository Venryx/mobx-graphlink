import { ApolloClient, NormalizedCacheObject } from "@apollo/client";
export declare const introspectionQuery: import("@apollo/client").DocumentNode;
/**
    TypeScript class reprsenting the data returned from an introspection query. (see `introspectionQuery`, exported from mobx-graphlink, with its code in `GQLIntrospector.ts`)
*/
export declare class GQLTypeShape {
    name: string;
    kind?: string;
    description?: string;
    fields?: GQLFieldShape[];
}
export declare class GQLFieldShape {
    name: string;
    type: GQLTypeShape;
}
export declare class GQLIntrospector {
    introspectionComplete: boolean;
    typeShapes: {
        [key: string]: GQLTypeShape;
    };
    RetrieveTypeShapes(apollo: ApolloClient<NormalizedCacheObject>): Promise<void>;
}
