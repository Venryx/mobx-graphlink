import firebase from "firebase";

export type QueryOpType = "where" | "orderBy" | "limit";
export abstract class QueryOp {
	static ParseData(json: any) {
		if (json.type == "where") return new WhereOp(json.fieldPath, json.comparison, json.value);
		if (json.type == "orderBy") return new OrderByOp(json.fieldPath, json.direction);
		if (json.type == "limit") return new LimitOp(json.count);
		return null as never;
	}

	type: QueryOpType;
	abstract Apply(collection: firebase.firestore.CollectionReference);
}

export class WhereOp extends QueryOp {
	constructor(public fieldPath: string, public comparison: firebase.firestore.WhereFilterOp, public value: any) {
		super();
		this.type = "where";
	}

	Apply(collection: firebase.firestore.CollectionReference) {
		// collection.where complains if value is undefined, so use null instead
		return collection.where(this.fieldPath, this.comparison, this.value ?? null);
	}
}
/*export const Where = (...args: ConstructorParameters<typeof WhereOp>)=> {
	return new WhereOp(...args);
};*/

export class OrderByOp extends QueryOp {
	constructor(public fieldPath: string, public direction: firebase.firestore.OrderByDirection = "asc") {
		super();
		this.type = "orderBy";
	}

	Apply(collection: firebase.firestore.CollectionReference) {
		return collection.orderBy(this.fieldPath, this.direction);
	}
}

export class LimitOp extends QueryOp {
	constructor(public count: number) {
		super();
		this.type = "limit";
	}

	Apply(collection: firebase.firestore.CollectionReference) {
		return collection.limit(this.count);
	}
}