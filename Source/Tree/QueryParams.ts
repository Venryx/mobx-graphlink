import {DocumentNode, gql} from "@apollo/client/core/index.js";
import {Assert, CE, Clone, FromJSON, ToJSON} from "js-vextensions";
import {TableNameToDocSchemaName, TableNameToGraphQLDocRetrieverKey} from "../Extensions/Decorators.js";
import {ConstructGQLArgsStr} from "../Extensions/GQLSchemaHelpers.js";
import {GetSchemaJSON} from "../Extensions/JSONSchemaHelpers.js";
import {TreeNode, TreeNodeType} from "./TreeNode.js";

export class QueryParams {
	static ParseString(dataStr: string) {
		return QueryParams.ParseData(FromJSON(dataStr));
	}
	static ParseData(data: any) {
		return new QueryParams(data);
	}
	toString() {
		//return ToJSON(CE(this).Including("variablesStr", "variables"));
		//return ToJSON(this);
		return ToJSON(this);
	}

	/** This function cleans the data-structure. (ie. requests with identical meanings but different json-strings, are made uniform) */
	Clean?() {
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
			console.log("BeforeFilter:", this.filter, "AfterFilter:", filterObj_final);
		}
		return this;
	}

	constructor(initialData?: Partial<QueryParams_Linked>) {
		CE(this).Extend(initialData);
	}

	/** Example: "$limit: Int!, $maxValue: Int!" */
	varsDefine?: string;
	/** Example: {limit: 10, maxValue: 100} */
	vars?: Object;

	// arguments (definition: https://stackoverflow.com/a/55474252)
	// ==========

	// old way 1; dropped for now, since there are two many filters-and-such possible with the connection-filter plugin
	//queryOps = [] as QueryOp[];

	// old way 2; dropped, since safer to use JSON stringification
	/*#* Example: "first: $limit, filter: {someProp: {lessThan: $maxValue}}" */
	//argsStr?: string;

	// enables stuff like "id: $id" (direct selection-by-id, rather than using filter system)
	args_rawPrefixStr?: string;
	// for other random things possible on server-side 
	args_custom?: Object;

	// filtering
	/** Example: {someProp: {lessThan: $maxValue}}*/
	filter?: Object;

	// pagination
	first?: number;
	after?: string;
	last?: number;
	before?: string;
}

/** Class specifies the filtering, sorting, etc. for a given TreeNode. */
// (comments based on usage with Postgraphile and https://github.com/graphile-contrib/postgraphile-plugin-connection-filter)
export class QueryParams_Linked extends QueryParams {
	toString() {
		return ToJSON(this);
	}

	constructor(initialData?: {treeNode: TreeNode<any>} & Partial<QueryParams_Linked>) {
		super();
		CE(this).Extend(initialData);
		this.Clean!(); // our data is probably already cleaned (ie. if called from "TreeNode.Get(...)"), but clean it again (in case user called this constructor directly)
		this.CalculateDerivatives();
	}
	
	treeNode: TreeNode<any>;
	get CollectionName(): string {
		return this.treeNode.pathSegments[0];
	}
	get DocSchemaName() {
		return TableNameToDocSchemaName(this.CollectionName);
	}

	// derivatives
	private queryStr: string;
	get QueryStr() { return this.queryStr; }
	private graphQLQuery: DocumentNode;
	get GraphQLQuery() { return this.graphQLQuery; }
	CalculateDerivatives() {
		if (this.treeNode.type != TreeNodeType.Root) {
			this.queryStr = this.ToQueryStr();
			this.graphQLQuery = gql(this.queryStr);
		}
	}

	ToQueryStr() {
		Assert(this.treeNode.type != TreeNodeType.Root, "Cannot create QueryParams for the root TreeNode.");
		const docSchema = GetSchemaJSON(this.DocSchemaName);
		Assert(docSchema, `Cannot find schema with name "${this.DocSchemaName}".`);

		const nonNullAutoArgs = ["first", "after", "last", "before", "filter"].filter(key=>{
			if (this[key] == null) return false;
			const IsEmptyObj = obj=>typeof obj == "object" && (Object.keys(obj).length == 0 || Object.values(obj).filter(a=>a != null).length == 0);
			if (IsEmptyObj(this[key])) return false; // don't add if just empty object (server complains)
			if (IsEmptyObj(Object.values(this[key]).filter(a=>a)[0])) return false; // don't add if just object containing empty object(s) (server complains)
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
		if (this.args_rawPrefixStr || Object.keys(this.args_custom ?? {}).length || nonNullAutoArgs.length) {
			const argsObj = {} as any;

			// add custom args
			for (const [key, value] of Object.keys(this.args_custom ?? {})) {
				argsObj[key] = value;
			}
			
			// add auto args
			for (const key of nonNullAutoArgs) {
				argsObj[key] = this[key];
			}

			console.log("ArgsObj:", JSON.stringify(argsObj));
			argsStr = ConstructGQLArgsStr(argsObj, this.args_rawPrefixStr);
		}
		
		
		if (this.treeNode.type == TreeNodeType.Document) {
			const propPairs = CE(docSchema.properties!).Pairs();
			Assert(propPairs.length > 0, `Cannot create GraphQL type for "${this.DocSchemaName}" without at least 1 property.`);
			return `
				subscription DocInCollection_${this.CollectionName}${WithBrackets(this.varsDefine)} {
					${TableNameToGraphQLDocRetrieverKey(this.CollectionName)}${WithBrackets(argsStr)} {
						${propPairs.map(a=>a.key).join(" ")}
					}
				}
			`;
		} else {
			const propPairs = CE(docSchema.properties!).Pairs();
			Assert(propPairs.length > 0, `Cannot create GraphQL type for "${this.CollectionName}" without at least 1 property.`);

			return `
				subscription Collection_${this.CollectionName}${WithBrackets(this.varsDefine)} {
					${this.CollectionName}${WithBrackets(argsStr)} {
						nodes { ${propPairs.map(a=>a.key).join(" ")} }
					}
				}
			`;
		}
	}
}
/** Adds round-brackets around the passed string, eg. "(...)", if it's non-empty. */
export function WithBrackets(str: string|null|undefined) {
	if (str == null || str.length == 0) return "";
	return `(${str})`;
}