# MobX Graphlink

Integrate data from a GraphQL backend into MobX and React with declarative path requests. (built on Apollo)

### Installation

```
npm install mobx-graphlink --save-exact
```

The `--save-exact` flag is recommended (to disable version-extending), since this package uses [Explicit Versioning](https://medium.com/sapioit/why-having-3-numbers-in-the-version-name-is-bad-92fc1f6bc73c) (`Release.Breaking.FeatureOrFix`) rather than SemVer (`Breaking.Feature.Fix`).

For `FeatureOrFix` version-extending (recommended for libraries), prepend "`~`" in `package.json`. (for `Breaking`, prepend "`^`")

### Setup

1) TODO
2) Create classes and json-schemas for row/document types. Example:
```
export class TodoItem {
	id: string;
	text: string;
	completed: boolean;
	tags: string[];
}
AddSchema("TodoItem", {
	properties: {
		id: {type: "string"},
		text: {type: "string"},
		completed: {type: "boolean"},
		tags: {items: {type: "string"}},
	},
});
```
3) Create class containing DB structure information. Example:
```
export class GraphDBShape {
	@Col("TodoItem") todoItems: Collection<TodoItem>;
}
```
4) Create Graphlink instance:
```
declare module "mobx-graphlink/Dist/UserTypes" {
	// if you're using an app-wide mobx data-store, that you want easily accessible within StoreAccessor funcs
	interface RootStoreShape extends RootState {}
	
	// shares the GraphDBShape class above (along with its TS type-constraints) with the mobx-graphlink library
	interface DBShape extends GraphDBShape {}
}

export const graph = new Graphlink<RootState, GraphDBShape>();
store.graphlink = graph;
SetDefaultGraphOptions({graph});

export function InitGraphlink() {
	graph.Initialize({rootStore: store});
}
```
5) Follow the instructions [here](https://github.com/apollographql/apollo-client/issues/7734#issuecomment-782587795) to fix a typing issue in `ts-invariant`.

### Usage

TODO

### Alternatives

TODO