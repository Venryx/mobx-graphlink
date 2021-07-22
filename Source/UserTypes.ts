/*
The interfaces below should be extended by the user project.

Example:
==========
import MyRootStoreShape from "some/path/to/project/type";
import MyDBShape from "some/path/to/project/type";

declare module 'mobx-graphlink/Dist/UserTypes' {
	interface RootStoreShape extends MyRootStoreShape {}
	interface DBShape extends MyDBShape {}
}
==========

This enables you to get typing within CreateAccessor, GetDocs, etc. without having to pass type-data in each call.

Note: This approach only works "once" per codebase; so it shouldn't be used by libraries. For libraries, you should do the following:
==========
// in some module
export const graph = new Graphlink<RootStoreShape, DBShape>();

// in other modules (store/db shapes will be extracted from the type-data of the passed "graph" variable)
export const GetPerson = CreateAccessor({graph}, ...);
export const person = GetDoc({graph}, ...);
==========
*/

export interface UT_StoreShape {}
export interface UT_DBShape {}