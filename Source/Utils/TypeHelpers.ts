export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/** Because the db-class fields are defined based on their "in table" state, this means the "id" field is "required" (as seen by TypeScript and ajv)
 * Thus, we can use this NoID helper to make creating new instances a bit easier: `let newInstance = {} as NoID<MyClass>;`*/
//export type NoID<T> = Omit<T, "id"> & {id?: string};
export type NoID<T extends {id: string}> = PartialBy<T, "id">;