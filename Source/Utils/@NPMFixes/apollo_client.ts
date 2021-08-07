/*
This file is a temp fix for package.json issue in @apollo/client. (see here for some context: https://github.com/apollographql/apollo-client/pull/8396)

Alternately, if loading lib as ESM:
1) Open all the `package.json` files under `node_modules/@apollo/client`.
2) Add the line `"type": "module"`. (There are many `package.json` files, so use a search-and-replace tool (eg. grep or grepWin: https://tools.stefankueng.com/grepWin.html), replacing `"module":` with `"type": "module", "module":`.)
*/

export type {FetchResult, ApolloClient, NormalizedCacheObject, DocumentNode} from "@apollo/client/core/index.js";
//export {gql} from "@apollo/client/core/index.js";
/*import core_ from "@apollo/client/core/index.js";
export const {gql} = core_;*/
//export {default as gql} from "graphql-tag"; 
export {default as gql} from "graphql-tag/lib/index.js"; 

export type {Observable} from "@apollo/client/utilities/index.js";