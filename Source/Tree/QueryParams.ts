import {DocumentNode, gql} from "@apollo/client";
import {Assert, CE, Clone} from "js-vextensions";
import {JSONSchema7, JSONSchema7Definition} from "json-schema";
import {TableNameToDocSchemaName, TableNameToGraphQLDocRetrieverKey} from "../Extensions/Decorators.js";
import {ConstructGQLArgsStr} from "../Extensions/GQLSchemaHelpers.js";
import {GetSchemaJSON} from "../Extensions/JSONSchemaHelpers.js";
import {TreeNode, TreeNodeType} from "./TreeNode.js";
import {GQLIntrospector} from "../DBShape/GQLIntrospector.js";

export class QueryParams {
	static ParseString(dataStr: string) {
		return QueryParams.ParseData(JSON.parse(dataStr));
	}
	static ParseData(data: any) {
		return new QueryParams(data);
	}
	/** This implementation is ONLY here for easier debugging! Do NOT rely on this being present on a given QueryParams object. (instead call `QueryParams.ToJSON(params)`) */
	toString() { //cleanFirst = true) {
		//if (cleanFirst) QueryParams.Clean(this);
		return JSON.stringify(this);
	}

	static ToJSON(self: QueryParams) { //, cleanFirst = true) {
		//if (cleanFirst) QueryParams.Clean(this);
		return JSON.stringify(self);
	}
	/** This function cleans the data-structure. (ie. for requests with identical meanings but different json-strings, this makes them uniform)
	 * Note that this is ONLY automatically called if passed to this library through the `GetDocs_Options.params` property; for other paths, you must call this Clean() function manually. */
	static Clean(self: QueryParams) {
		if (self.filter) {
			const filterObj_final = Clone(self.filter);
			// iterate on entries in self.filter (not filterObj_final), because Clone(...) strips away fields with value of `undefined` (and we want to raise an error if such a thing exists)
			for (const [key, value] of Object.entries(self.filter)) {
				// check for these valid (but empty) filters: {myField: null} OR {myField: false && {...}}
				const isShortCircuit = value == null || value == false;
				if (isShortCircuit) {
					delete filterObj_final[key];
					continue;
				}

				// check for these invalid filters: {myField: 25} OR {myField: {}}
				const baseErrStr = `Invalid filter-entry found in QueryParams`;
				const isNonObjectOrUnpopulated = typeof value != "object" || Object.entries(value).length == 0;
				if (isNonObjectOrUnpopulated) throw new Error(`${baseErrStr}: filter.${key} -> ${JSON.stringify(value)} (expected an object [with filter-ops inside], or null/false to short-circuit)`);

				// check for these invalid filters: {myField: {equalTo: undefined}}
				// (if you want myField to equal null, use `{equalTo: null}` rather than `{equalTo: undefined}`; undefined causes problems in javascript, eg. `Clone({myField: undefined})` becomes just `{}`)
				const invalidOps = Object.entries(value).filter(entry=>entry[1] === undefined);
				if (invalidOps.length > 0) {
					const firstImproperOp = invalidOps[0][0];
					throw new Error(`${baseErrStr}: filter.${key}.${firstImproperOp} -> undefined (if filtering is undesired, remove the "${key}" entry entirely, or set "${key}" to null/false; if wanting to filter against null, set ${key}.${firstImproperOp} to null rather than undefined)`);
				}
			}
			self.filter = filterObj_final;
		}
		return self;
	}

	constructor(initialData?: Partial<QueryParams_Linked>) {
		Object.assign(this, initialData);
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
		return JSON.stringify(this);
	}

	constructor(initialData?: {treeNode: TreeNode<any>} & Partial<QueryParams_Linked>) {
		super();
		CE(this).Extend(initialData);
		QueryParams.Clean(this); // our data is probably already cleaned (ie. if called from "TreeNode.Get(...)"), but clean it again (in case user called this constructor directly)
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
	derivatives_state_introspectionCompleted = false;
	StateChangedForDerivatives() {
		return this.treeNode.graph.introspector.introspectionComplete != this.derivatives_state_introspectionCompleted;
	}
	private queryStr: string;
	QueryStr(recalcDerivatesIfStateChanged = true) {
		if (recalcDerivatesIfStateChanged && this.StateChangedForDerivatives()) {
			this.CalculateDerivatives();
		}
		return this.queryStr;
	}
	private graphQLQuery: DocumentNode;
	GraphQLQuery(recalcDerivatesIfStateChanged = true) {
		if (recalcDerivatesIfStateChanged && this.StateChangedForDerivatives()) {
			this.CalculateDerivatives();
		}
		return this.graphQLQuery;
	}
	CalculateDerivatives() {
		if (this.treeNode.type != TreeNodeType.Root) {
			this.derivatives_state_introspectionCompleted = this.treeNode.graph.introspector.introspectionComplete;
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

			// commented; the Clean() function should already be avoiding these problems; if problems persist, we *want* the server to detect the problem and alert us of the flaw in QueryParams.Clean()
			/*const IsEmptyObj = obj=>typeof obj == "object" && (Object.keys(obj).length == 0 || Object.values(obj).filter(a=>a != null).length == 0);
			if (IsEmptyObj(this[key])) return false; // don't add if just empty object (server complains)
			if (IsEmptyObj(Object.values(this[key]).filter(a=>a)[0])) return false; // don't add if just object containing empty object(s) (server complains)
			/#*if (IsEmptyObj(this[key])) {
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

			argsStr = ConstructGQLArgsStr(argsObj, this.args_rawPrefixStr);
		}

		if (this.treeNode.type == TreeNodeType.Document) {
			return `
				subscription DocInCollection_${this.CollectionName}${WithBrackets(this.varsDefine)} {
					${TableNameToGraphQLDocRetrieverKey(this.CollectionName)}${WithBrackets(argsStr)} {
						${JSONSchemaToGQLFieldsStr(docSchema, this.DocSchemaName, this.treeNode.graph.introspector)}
					}
				}
			`;
		}
		return `
			subscription Collection_${this.CollectionName}${WithBrackets(this.varsDefine)} {
				${this.CollectionName}${WithBrackets(argsStr)} {
					changeType
					idOfRemoved
					data {
						${JSONSchemaToGQLFieldsStr(docSchema, this.DocSchemaName, this.treeNode.graph.introspector)}
					}
				}
			}
		`;
	}
}
/** Adds round-brackets around the passed string, eg. "(...)", if it's non-empty. */
export function WithBrackets(str: string|null|undefined) {
	if (str == null || str.length == 0) return "";
	return `(${str})`;
}

export class ListChange {
	changeType: ListChangeType;
	idOfRemoved: string;
	data: any;
}
export enum ListChangeType {
	FullList = "FullList",
	EntryAdded = "EntryAdded",
	EntryChanged = "EntryChanged",
	EntryRemoved = "EntryRemoved",
}

export const gqlScalarTypes = [
	// standard
	"Boolean", "Int", "Float", "String", "ID",
	// for postgresql
	"JSON",
];
export function JSONSchemaToGQLFieldsStr(schema: JSONSchema7, schemaName: string, introspector: GQLIntrospector) {
	//const fields = CE(schema.properties!).Pairs();
	const fields = Object.entries(schema.properties!);
	Assert(fields.length > 0, `Cannot create GraphQL query-string for schema "${schemaName}", since it has 0 fields.`);

	const serverTypeForSchema = introspector.TypeShape(schemaName);
	const fields_final = fields.filter(([fieldKey, fieldValue])=>{
		// if server doesn't have this field as an "actual field" in its declared graphql schema, then skip it (ie. leave its data as part of the "extras" field)
		if (serverTypeForSchema?.fields && !serverTypeForSchema.fields.some(a=>a.name == fieldKey)) return false;
		return true;
	});

	// maybe temp/needs-rework: for now, just always make sure we request the "extras" field (even if project doesn't need data beyond the TS struct's defined fields, mobx-graphlink needs the "extras" field in-case server gql doesn't know-of/declare those fields)
	if (!fields_final.some(([fieldKey])=>fieldKey == "extras")) {
		fields_final.push(["extras", {type: "object"}]);
	}

	//return fields.map(field=>{
	return fields_final.map(([fieldKey, fieldValue_raw])=>{
		let fieldValue = fieldValue_raw;
		// for fields with {opt: true}, mobx-graphlink (on client) sometimes has to use the `{anyOf: [{...}, {type: "null"}]` pattern to represent the nullability, so handle that case
		if (Object.keys(fieldValue_raw).length == 1 && fieldValue_raw["anyOf"] != null) {
			fieldValue = (fieldValue_raw["anyOf"] as JSONSchema7[]).find(a=>a.type != "null") as JSONSchema7Definition;
		}

		// guess at whether the field is a scalar
		let isScalar = fieldValue["$gqlTypeIsScalar"] ?? true;

		// (atm, field is assumed a scalar unless it has a $gqlType specified in its json-schema whose type-name doesn't match the hard-coded list of scalars)
		const declaredGQLType = fieldValue["$gqlType"];
		if (declaredGQLType) {
			const declaredGQLType_simplified = declaredGQLType.replace(/[^a-zA-Z0-9_]/g, "");
			if (!gqlScalarTypes.includes(declaredGQLType_simplified)) {
				isScalar = false;
			}
		}

		// if field's gql-type is not a scalar, then expand that field to its set of subfields
		if (!isScalar) {
			const fieldTypeName = fieldValue["$ref"] ?? fieldValue["items"]?.["$ref"];
			const fieldTypeSchema = GetSchemaJSON(fieldTypeName);
			return `${fieldKey} {
				${JSONSchemaToGQLFieldsStr(fieldTypeSchema, fieldTypeName, introspector)}
			}`;
		}

		return fieldKey;
	}).join("\n");
}