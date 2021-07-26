import process from "process";
import chokidar from "chokidar";
import paths from "path";
import glob from "tiny-glob";
import fs from "fs";
import strip from "strip-comments";
import { Command } from "commander";

type __ = typeof import("js-vextensions/Helpers/@ApplyCETypes");
import "js-vextensions/Helpers/@ApplyCECode.js";

const program = new Command();
program
	.option("--classFolders <paths...>", "Paths (from cwd) to folders in which the @MGLClass code files can be found.")
	.option("--templateFile <path>", `Path  (from cwd) to folder containing "Template.ts", and where to place the db-init output script.`)
	.option("--outFile <path>", `Path  (from cwd) to folder containing "Template.ts", and where to place the db-init output script.`)
	.option("--watch", `If set, will use "watch mode" -- rebuilding the init-db script whenever the db-shape files are modified.`);
program.parse(process.argv);
const programOpts = program.opts() as {classFolders: string[], templateFile: string, outFile: string, watch: boolean};

const repoRoot = process.cwd();
const classFolders_paths = programOpts.classFolders.map(a=>paths.isAbsolute(a) ? a : paths.join(repoRoot, a));
const templateFilePath = paths.join(repoRoot, programOpts.templateFile);
const outFilePath = paths.join(repoRoot, programOpts.outFile);
const watch = programOpts.watch;
//console.log("Args:", process.argv, "@watchPath:", watchPath);

// watch template-file and class-folders
if (watch) {
	const changeHandler = (event, path) => {
		if (path == templateFilePath) {
			if (event == "change") {
				console.log(event, path);
				BuildDBShapeFile();
			}
		} else {
			if (event == "change" && paths.basename(path).startsWith("@")) {
				console.log(event, path);
				BuildDBShapeFile();
			}
		}
	};
	chokidar.watch(templateFilePath).on("all", changeHandler);
	console.log(`Watching: "${templateFilePath}"`);
	for (const classFolderPath of classFolders_paths) {
		chokidar.watch(classFolderPath).on("all", changeHandler);
		console.log(`Watching: "${classFolderPath}"`);
	}
}

class TableInfo {
	name: string;
	earlyInitFuncCode: string;
	fields = [] as FieldInfo[];
}
class FieldInfo {
	name: string;
	initFuncCode: string;
}

function StripComments(str: string) {
	let result = strip(str);

	// fix for issue: https://github.com/jonschlinkert/strip-comments/issues/48
	result = result.replace(/^(\s*)\/\/(.*)$/gm, "");

	return result;
}

BuildDBShapeFile();
async function BuildDBShapeFile() {
	const mglClassFiles = [] as string[];
	for (const folderPath of classFolders_paths) {
		mglClassFiles.push(...await glob("**/@*.ts", {cwd: folderPath, absolute: true}));
	}

	const tableInfos = new Map<string, TableInfo>();
	for (const filePath of mglClassFiles) {
		const code = fs.readFileSync(filePath).toString();
		const code_noComments = StripComments(code) as string;

		const tableNameMatches = code_noComments.Matches(/table: "(.+?)"/);
		const tablePreInitFuncMatches = code_noComments.Matches(/\st=>/);
		const fieldDecoratorMatches = code_noComments.Matches(/@DB\(/);
		const fieldNameMatches = code_noComments.Matches(/^\t(\w+)\??(: | = )/m); // eg. "	id: string;"
		console.log(`In file "${paths.basename(filePath)}", found matches:${""
			} tableNames(${tableNameMatches.length}),${""
			} tablePreInitFuncs(${tablePreInitFuncMatches.length}),${""
			} fieldDecorators(${fieldDecoratorMatches.length}), ${""
			} fieldNames(${fieldNameMatches.length})`);

		for (const match of tableNameMatches) {
			const tableName = match[1];
			if (tableInfos.has(tableName)) throw new Error(`Found multiple classes claiming to be the source for the "${tableName}" table.`);
			tableInfos.set(tableName, {
				name: tableName,
				fields: [],
			} as TableInfo);
		}

		for (const match of tablePreInitFuncMatches) {
			// find first "@MGLClass({table: "XXX"})" line prior to table's pre-init-func, and extract table-name from it
			const tableName = tableNameMatches.find(a=>a.index < match.index)?.[1];
			const tableInfo = tableInfos.get(tableName);

			let earlyInitFuncCode: string;
			let bracketDepth = 0;
			let startBracketIndex: number;
			for (let i = match.index; i < code_noComments.length; i++) {
				if (code_noComments[i] == "{") {
					bracketDepth++;
					startBracketIndex = startBracketIndex ?? i;
				} else if (code_noComments[i] == "}") {
					bracketDepth--;
				}
				// if we found start bracket, and now we"re back to depth 0, we"ve reached the end of the decorator code
				if (startBracketIndex != null && bracketDepth == 0) {
					earlyInitFuncCode = code_noComments.slice(startBracketIndex + 1, i);
					break;
				}
			}
			tableInfo.earlyInitFuncCode = earlyInitFuncCode;
		}

		for (const match of fieldDecoratorMatches) {
			let decoratorCode: string;
			let decoratorFuncCode: string;
			let bracketDepth = 0;
			let startBracketIndex: number;
			for (let i = match.index; i < code_noComments.length; i++) {
				if (code_noComments[i] == "(") {
					bracketDepth++;
					startBracketIndex = startBracketIndex ?? i;
				} else if (code_noComments[i] == ")") {
					bracketDepth--;
				}
				// if we found start bracket, and now we"re back to depth 0, we"ve reached the end of the decorator code
				if (startBracketIndex != null && bracketDepth == 0) {
					decoratorCode = code_noComments.slice(match.index, i + 1);
					decoratorFuncCode = code_noComments.slice(startBracketIndex + 1, i);
					break;
				}
			}
			
			// find last "@MGLClass({table: "XXX"})" line prior to field-decorator line, and extract table-name from it
			const tableName = tableNameMatches.filter(a=>a.index < match.index).pop()?.[1];
			if (tableName == null) throw new Error(`Could not find table-name line in "${paths.basename(filePath)}", before @DB decorator line: ${decoratorCode}`);
			// find first "fieldName: SomeType" line after field-decorator line, and extract field-name from it
			const fieldName = fieldNameMatches.find(a=>a.index > match.index)?.[1];
			if (fieldName == null) throw new Error(`Could not find field-name line in "${paths.basename(filePath)}", after @DB decorator line: ${decoratorCode}`);

			//if (!tableFieldInfos.has(tableName)) tableFieldInfos.set(tableName, []);
			tableInfos.get(tableName).fields.push({name: fieldName, initFuncCode: decoratorFuncCode});
		}
	}

	const dynamicCodeOutputLines = [];
	for (const tableInfo of tableInfos.values()) {
		// if table has no fields defined, don't create it (else postgraphile errors)
		if (tableInfo.fields.length == 0) continue;
		
		dynamicCodeOutputLines.push(`
await knex.schema.createTable(\`\${v}${tableInfo.name}\`, t=>{${""
}${tableInfo.earlyInitFuncCode ? "\n" + tableInfo.earlyInitFuncCode.AsMultiline(1) : ""}
${tableInfo.fields.map(field=>{
	//const initFuncCode_final = field.initFuncCode.replace(/([^$])\{v\}/g, (str, p1)=>(p1 + "${v}"));
	const initFuncCode_final = field.initFuncCode.replace(/inTable\(/g, "inTable(v + ");
	return `\tRunFieldInit(t, "${field.name}", ${initFuncCode_final});`;
}).join("\n")}
});
		`.AsMultiline(1));
	}
	const dynamicCodeOutput = dynamicCodeOutputLines.join("\n\n");

	const templateCode = fs.readFileSync(templateFilePath).toString();
	const finalDBInitScript = templateCode.replace(/\t+\/\/ PLACEHOLDER_FOR_DYNAMIC_CODE/, dynamicCodeOutput);
	fs.writeFileSync(outFilePath, finalDBInitScript);
}