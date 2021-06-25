import process from "process";
import chokidar from "chokidar";
import paths from "path";
import glob from "tiny-glob";
import fs from "fs";
import strip from "strip-comments";
import { Command } from "commander";

type __ = typeof import("../node_modules/js-vextensions/Helpers/@ApplyCETypes");
import "js-vextensions/Helpers/@ApplyCECode.js";

const program = new Command();
program
	.option("--classesFolder <path>", "Path (from cwd) to folder in which all @MGLClass code files can be found.")
	.option("--templateFile <path>", `Path  (from cwd) to folder containing "Template.ts", and where to place the db-init output script.`)
	.option("--outFile <path>", `Path  (from cwd) to folder containing "Template.ts", and where to place the db-init output script.`);
program.parse(process.argv);
const programOpts = program.opts() as {classesFolder: string, templateFile: string, outFile: string};

const repoRoot = process.cwd();
const classesFolderPath = paths.join(repoRoot, programOpts.classesFolder);
const templateFilePath = paths.join(repoRoot, programOpts.templateFile);
const outFilePath = paths.join(repoRoot, programOpts.outFile);
//console.log("Args:", process.argv, "@watchPath:", watchPath);

// watch classes-folder and template-file
chokidar.watch([classesFolderPath, templateFilePath]).on("all", (event, path) => {
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
});
console.log(`Watching: "${classesFolderPath}", "${templateFilePath}"`);

interface FieldInfo {
	name: string;
	initFuncCode: string;
}

BuildDBShapeFile();
async function BuildDBShapeFile() {
	const mglClassFiles = await glob("**/@*.ts", {cwd: classesFolderPath, absolute: true});

	const tableFieldInfos = new Map<string, FieldInfo[]>();
	for (const filePath of mglClassFiles) {
		const code = fs.readFileSync(filePath).toString();
		const code_noComments = strip(code) as string;

		const tableNameMatches = code_noComments.Matches(/table: "(.+?)"/);
		const fieldDecoratorMatches = code_noComments.Matches(/@DB\(/);
		const fieldNameMatches = code_noComments.Matches(/\t+(\w+)\??(: | = )/); // eg. "	id: string;"
		console.log(`In file "${paths.basename(filePath)}", found matches: tableNames(${tableNameMatches.length}), fieldDecorators:${fieldDecoratorMatches.length}, fieldNames:${fieldNameMatches.length}`);

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

			if (!tableFieldInfos.has(tableName)) tableFieldInfos.set(tableName, []);
			tableFieldInfos.get(tableName).push({name: fieldName, initFuncCode: decoratorFuncCode});
		}
	}

	const dynamicCodeOutputLines = [];
		for (const tableName of tableFieldInfos.keys()) {
			dynamicCodeOutputLines.push(`
await knex.schema.createTable(\`\${v}${tableName}\`, t=>{
${tableFieldInfos.get(tableName).map(field=>{
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