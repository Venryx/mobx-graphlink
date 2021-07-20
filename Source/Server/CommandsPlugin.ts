//import {makeExtendSchemaPlugin, gql} from "graphile-utils";
import graphileUtils from "graphile-utils";
import {Assert, CE} from "js-vextensions";
import {PoolClient} from "pg";
import {Context as Context_base} from "postgraphile";
import {GetGQLSchemaInfoFromJSONSchema} from "../Extensions/GQLSchemaHelpers.js";
import {GetSchemaJSON, schemaEntryJSONs} from "../Extensions/JSONSchemaHelpers.js";
import {WithBrackets} from "../Tree/QueryParams.js";
import {Command} from "./Command.js";
import {GetCommandClassMetadatas} from "./CommandMetadata.js";
const {makeExtendSchemaPlugin, gql} = graphileUtils;

type Context = Context_base<any> & {
	pgClient: PoolClient;
};

function GQL_BetterErrorHandling(str: string) {
	try {
		return gql`${str}`;
	} catch (ex) {
		console.log("GQL error hit for str:", str);
		throw ex;
	}
}

class CommandRunInfo {
	parent: any;
	args: any[];
	context: Context;
	info: any;
	command: Command<any>;
};
class CreateCommandPlugin_Options {
	schemaDeps_auto?: boolean;
	schemaDeps_auto_exclude?: string[];
	schemaDeps?: string[];
	typeDefStrFinalizer?: (str: string)=>string;
	preCommandRun?: (info: CommandRunInfo)=>any;
	postCommandRun?: (info: CommandRunInfo & {returnData: any, error: any})=>any;
}

export const CreateCommandsPlugin = (opts: CreateCommandPlugin_Options)=>{
	return makeExtendSchemaPlugin((build, schemaOptions)=>{
		const commandClassMetas = GetCommandClassMetadatas();

		const allNewTypeDefs_strings = [] as string[];

		// there are a few schemas that are referenced by the command-classes, but which are not "MGLClass main types" (and thus are not yet part of the graphql types); so add them here
		const schemaDeps = [] as string[];
		if (opts.schemaDeps_auto) {
			for (const name of schemaEntryJSONs.keys()) {
				if (opts.schemaDeps_auto_exclude?.includes(name)) continue;
				// if can't find schema already added to graphql, add it now
				const gqlSchemaMatch = build.getTypeByName(name);
				console.log("@name:", name, "@match:", gqlSchemaMatch);
				if (gqlSchemaMatch == null) {
					schemaDeps.push(name);
				}
			}
		}
		if (opts.schemaDeps) {
			schemaDeps.push(...opts.schemaDeps);
		}
		let startTime = Date.now();
		console.log("SchemaDeps:", schemaDeps, "@start:", startTime);
		for (const dep of schemaDeps) {
			const depJSONSchema = GetSchemaJSON(dep);
			Assert(depJSONSchema, `Could not find schema-json for schema-dep "${dep}".`);
			const graphqlInfo = GetGQLSchemaInfoFromJSONSchema({rootName: dep, jsonSchema: depJSONSchema, direction: "input"});
			const schemaStr_fixed = graphqlInfo.schemaAsStr.replace(new RegExp(`(\\W)${graphqlInfo.typeName}(\\W)`, "g"), (str, p1, p2)=>`${p1}${dep}${p2}`); // change type-name back to what it's supposed to be
			console.log("Test3:", graphqlInfo.typeName, "@str:", graphqlInfo.schemaAsStr, "@fixed:", schemaStr_fixed);
			allNewTypeDefs_strings.push(schemaStr_fixed);
		}
		console.log("SchemaDeps_DoneAfter:", Date.now() - startTime);

		for (const meta of commandClassMetas) {
			const typeDefStringsForEntry = [] as string[];

			// merge schema-dep graph-ql-strings into first command's graph-ql-str (else errors, because each entry must have an "extent type Mutation { ... }" part)
			if (meta == commandClassMetas[0]) {
				typeDefStringsForEntry.push(...allNewTypeDefs_strings);
				allNewTypeDefs_strings.length = 0;
			}

			// type-defs (used by mutation-resolver type)
			for (const typeDef of meta.payload_graphqlInfo.typeDefs) {
				if (build.getTypeByName(typeDef.name)) {
					console.log(`Type "${typeDef.name}" already found; not adding again.`);
					continue;
				}
				typeDefStringsForEntry.push(typeDef.str);
			}
			for (const typeDef of meta.return_graphqlInfo.typeDefs) {
				if (build.getTypeByName(typeDef.name)) {
					console.log(`Type "${typeDef.name}" already found; not adding again.`);
					continue;
				}
				typeDefStringsForEntry.push(typeDef.str);
			}

			const returnGQLTypeName = meta.FindGQLTypeName({group: "return", typeName: `${meta.commandClass.name}_ReturnData`})!;

			// output example: "UpdateTerm(id: ID!, updates: UpdateTermT0UpdatesT0): UpdateTerm_ReturnT0"
			typeDefStringsForEntry.push(`
	extend type Mutation {
		${meta.commandClass.name}${WithBrackets(meta.Args_GetArgDefsStr())}: ${returnGQLTypeName}
	}
			`);

			//allNewTypeDefs_strings.push(...typeDefStringsForEntry);
			allNewTypeDefs_strings.push(typeDefStringsForEntry.join("\n\n")); // postgraphile is picky (bundle types with mutation-type-extension, because each entry must have a mutation-type-extension)
		}

		const mutationResolvers = CE(commandClassMetas).ToMapObj(meta=>meta.commandClass.name, classInfo=>{
			return async(parent, args, context: Context, info)=>{
				/*const { rows } = await context.pgClient.query(
					sqlText, // e.g. "select * from users where id = $1"
					optionalVariables // e.g. [27]
				);*/

				//context.pgClient.query()

				const CommandClass = classInfo.commandClass as any;
				const command: Command<any> = new CommandClass(args);
				Assert(context.req.user != null, "Cannot run command on server unless logged in.");
				command._userInfo_override = context.req.user;
				command._userInfo_override_set = true;

				opts.preCommandRun?.({parent, args, context, info, command});
				let returnData: any;
				let error: any;
				try {
					returnData = await command.RunLocally();
				} catch (ex) {
					error = ex;
					throw ex;
				} finally {
					opts.postCommandRun?.({parent, args, context, info, command, returnData, error});
				}
				
				return returnData;
			};
		});

		const allNewTypeDefs = allNewTypeDefs_strings.map(str=>{
			// if type-def string is empty, add a placeholder field (to avoid graphql error)
			if (!str.includes("{")) {
				str += " { _: Boolean }";
			}
			if (opts.typeDefStrFinalizer) str = opts.typeDefStrFinalizer(str);
			return GQL_BetterErrorHandling(str);
		});
		//console.log("CommandsPlugin init done. @typeDefs:\n==========\n", allNewTypeDefs_strings.join("\n\n"), "\n==========\n@mutationResolvers:", mutationResolvers);
		return {
			typeDefs: allNewTypeDefs,
			resolvers: {
				Mutation: mutationResolvers,
			},
		};
	});
};