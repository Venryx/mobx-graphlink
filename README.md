# MobX Graphlink

Integrate data from a GraphQL backend into MobX and React with declarative path requests. (built on Apollo)

### Installation

1) `npm install mobx-graphlink --save-exact`

The `--save-exact` flag is recommended (to disable version-extending), since this package uses [Explicit Versioning](https://medium.com/sapioit/why-having-3-numbers-in-the-version-name-is-bad-92fc1f6bc73c) (`Release.Breaking.FeatureOrFix`) rather than SemVer (`Breaking.Feature.Fix`).

For `FeatureOrFix` version-extending (recommended for libraries), prepend "`~`" in `package.json`. (for `Breaking`, prepend "`^`")

### Setup

1) TODO
2) Create classes and json-schemas for row/document types. Example:
```
@DBClass({table: "todoItems"})
export class TodoItem {
	@DB((t, n)=>t.text(n))
	@Field({type: "string"})
	id: string;

	@DB((t, n)=>t.text(n))
	@Field({type: "string"}, {req: true})
	text: string;

	@DB((t, n)=>t.boolean(n))
	@Field({type: "string"})
	completed: boolean;

	@DB((t, n)=>t.specificType(n, "text[]"))
	@Field({items: {type: "string"}})
	tags: string[];
}
```
3) Create class containing DB structure information. Example:
```
export class GraphDBShape {
	todoItems: Collection<TodoItem>;
}
```
4) Create Graphlink instance:
```
declare module "mobx-graphlink/Dist/UserTypes" {
	// if you're using an app-wide mobx data-store, that you want easily accessible within "accessor" funcs
	interface UT_StoreShape extends RootState {}
	
	// shares the GraphDBShape class above (along with its TS type-constraints) with the mobx-graphlink library
	interface UT_DBShape extends GraphDBShape {}
}

export const graph = new Graphlink<RootState, GraphDBShape>();
store.graphlink = graph;
SetDefaultGraphOptions({graph});

export function InitGraphlink() {
	graph.Initialize({rootStore: store});
}
```

### Usage

TODO

### Alternatives

TODO