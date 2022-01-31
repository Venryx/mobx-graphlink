import { Assert, CE, Clone, FromJSON, ToJSON } from "js-vextensions";
import { TableNameToDocSchemaName, TableNameToGraphQLDocRetrieverKey } from "../Extensions/Decorators.js";
import { ConstructGQLArgsStr } from "../Extensions/GQLSchemaHelpers.js";
import { GetSchemaJSON } from "../Extensions/JSONSchemaHelpers.js";
import { gql } from "../Utils/@NPMFixes/apollo_client.js";
import { TreeNodeType } from "./TreeNode.js";
export class QueryParams {
    constructor(initialData) {
        CE(this).Extend(initialData);
    }
    static ParseString(dataStr) {
        return QueryParams.ParseData(FromJSON(dataStr));
    }
    static ParseData(data) {
        return new QueryParams(data);
    }
    toString() {
        //return ToJSON(CE(this).Including("variablesStr", "variables"));
        //return ToJSON(this);
        return ToJSON(this);
    }
    /** This function cleans the data-structure. (ie. requests with identical meanings but different json-strings, are made uniform) */
    Clean() {
        if (this.filter) {
            const filterObj_final = Clone(this.filter);
            for (const [key, value] of Object.entries(filterObj_final)) {
                // first check blocks eg. "{filter: false && {...}}", and second check blocks eg. "{filter: {equalTo: null}}" (both would otherwise error)
                const isValidFilterEntry = (value != null && typeof value == "object"); // && Object.values(value as any).filter(a=>a != null).length;
                if (!isValidFilterEntry) {
                    delete filterObj_final[key];
                }
            }
            this.filter = filterObj_final;
        }
        return this;
    }
}
/** Class specifies the filtering, sorting, etc. for a given TreeNode. */
// (comments based on usage with Postgraphile and https://github.com/graphile-contrib/postgraphile-plugin-connection-filter)
export class QueryParams_Linked extends QueryParams {
    constructor(initialData) {
        super();
        CE(this).Extend(initialData);
        this.Clean(); // our data is probably already cleaned (ie. if called from "TreeNode.Get(...)"), but clean it again (in case user called this constructor directly)
        this.CalculateDerivatives();
    }
    toString() {
        return ToJSON(this);
    }
    get CollectionName() {
        return this.treeNode.pathSegments[0];
    }
    get DocSchemaName() {
        return TableNameToDocSchemaName(this.CollectionName);
    }
    get QueryStr() { return this.queryStr; }
    get GraphQLQuery() { return this.graphQLQuery; }
    CalculateDerivatives() {
        if (this.treeNode.type != TreeNodeType.Root) {
            this.queryStr = this.ToQueryStr();
            this.graphQLQuery = gql(this.queryStr);
        }
    }
    ToQueryStr() {
        var _a, _b;
        Assert(this.treeNode.type != TreeNodeType.Root, "Cannot create QueryParams for the root TreeNode.");
        const docSchema = GetSchemaJSON(this.DocSchemaName);
        Assert(docSchema, `Cannot find schema with name "${this.DocSchemaName}".`);
        const nonNullAutoArgs = ["first", "after", "last", "before", "filter"].filter(key => {
            if (this[key] == null)
                return false;
            const IsEmptyObj = obj => typeof obj == "object" && (Object.keys(obj).length == 0 || Object.values(obj).filter(a => a != null).length == 0);
            if (IsEmptyObj(this[key]))
                return false; // don't add if just empty object (server complains)
            if (IsEmptyObj(Object.values(this[key]).filter(a => a)[0]))
                return false; // don't add if just object containing empty object(s) (server complains)
            /*if (IsEmptyObj(this[key])) {
                throw new Error(`Query arg "${key}" is invalid; the value is empty (ie. null, a key-less object, or an object whose keys all have null assigned). @arg:${ToJSON_Advanced(this[key], {stringifyUndefinedAs: null})}`);
            }
            const firstNonNullSubObj = Object.values(this[key]).filter(a=>a)[0];
            if (IsEmptyObj(firstNonNullSubObj)) {
                throw new Error(`Query arg "${key}" is invalid; the value has no subobject that is non-empty. @arg:${ToJSON_Advanced(this[key], {stringifyUndefinedAs: null})}`);
            }*/
            return true;
        });
        let argsStr = "";
        if (this.args_rawPrefixStr || Object.keys((_a = this.args_custom) !== null && _a !== void 0 ? _a : {}).length || nonNullAutoArgs.length) {
            const argsObj = {};
            // add custom args
            for (const [key, value] of Object.keys((_b = this.args_custom) !== null && _b !== void 0 ? _b : {})) {
                argsObj[key] = value;
            }
            // add auto args
            for (const key of nonNullAutoArgs) {
                argsObj[key] = this[key];
            }
            argsStr = ConstructGQLArgsStr(argsObj, this.args_rawPrefixStr);
        }
        if (this.treeNode.type == TreeNodeType.Document) {
            const propPairs = CE(docSchema.properties).Pairs();
            Assert(propPairs.length > 0, `Cannot create GraphQL type for "${this.DocSchemaName}" without at least 1 property.`);
            return `
				subscription DocInCollection_${this.CollectionName}${WithBrackets(this.varsDefine)} {
					${TableNameToGraphQLDocRetrieverKey(this.CollectionName)}${WithBrackets(argsStr)} {
						${propPairs.map(a => a.key).join(" ")}
					}
				}
			`;
        }
        else {
            const propPairs = CE(docSchema.properties).Pairs();
            Assert(propPairs.length > 0, `Cannot create GraphQL type for "${this.CollectionName}" without at least 1 property.`);
            return `
				subscription Collection_${this.CollectionName}${WithBrackets(this.varsDefine)} {
					${this.CollectionName}${WithBrackets(argsStr)} {
						nodes { ${propPairs.map(a => a.key).join(" ")} }
					}
				}
			`;
        }
    }
}
/** Adds round-brackets around the passed string, eg. "(...)", if it's non-empty. */
export function WithBrackets(str) {
    if (str == null || str.length == 0)
        return "";
    return `(${str})`;
}
