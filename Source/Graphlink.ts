import firebase from "firebase/app";
import {TreeNode} from "./Tree/TreeNode";
import {TreeRequestWatcher} from "./Tree/TreeRequestWatcher";
import {PathOrPathGetterToPath, PathOrPathGetterToPathSegments} from "./Utils/PathHelpers";
import {observable, runInAction} from "mobx";

export let defaultFireOptions: FireOptions;
export function SetDefaultFireOptions(opt: FireOptions) {
	defaultFireOptions = opt;
}
export interface FireOptions<RootStoreShape = any, DBShape = any> {
	fire: Firelink<RootStoreShape, DBShape>;
}

export class FireUserInfo {
	id: string;
	displayName: string;
}

export class FirelinkInitOptions<RootStoreShape> {
	rootPathInDB: string | string[];
	rootStore: RootStoreShape;
	//initSubs = true;
}

export class Firelink<RootStoreShape, DBShape> {
	static instances = [] as Firelink<any, any>[];

	constructor(initOptions?: FirelinkInitOptions<RootStoreShape>) {
		if (initOptions) {
			this.Initialize(initOptions);
		}
	}

	initialized = false;
	Initialize(initOptions: FirelinkInitOptions<RootStoreShape>) {
		let {rootPathInDB, rootStore} = initOptions;

		Firelink.instances.push(this);
		/*this.versionPathSegments = ["versions", `v${dbVersion}-${dbEnv_short}`];
		this.versionPath = `versions/v${dbVersion}-${dbEnv_short}`;*/
		this.rootPathSegments = PathOrPathGetterToPathSegments(rootPathInDB);
		this.rootPath = PathOrPathGetterToPath(rootPathInDB);
		this.rootStore = rootStore;
		//if (initSubs) {
		this.InitSubs();
		this.tree = new TreeNode(this, []);
		
		this.initialized = true;
	}

	rootPathSegments: string[];
	rootPath: string;
	/*versionPathSegments: string[];
	versionPath: string;*/
	//versionData: DBShape;
	rootStore: RootStoreShape;
	storeOverridesStack = [] as RootStoreShape[];

	InitSubs() {
		this.subs.firestoreDB = firebase.firestore();
		firebase.auth().onAuthStateChanged((rawUserInfo)=> {
			runInAction("Firelink.onAuthStateChanged", ()=> {
				this.userInfo_raw = rawUserInfo;
				this.userInfo = rawUserInfo == null ? null : {
					id: rawUserInfo.uid,
					displayName: rawUserInfo.displayName!,
				};
			});
		});
	}
	subs = {} as {
		firestoreDB: firebase.firestore.Firestore;
	};

	//@observable userInfo_raw: firebase.auth.UserCredential;
	@observable userInfo_raw: firebase.User|null;
	@observable userInfo: FireUserInfo|null;
	async LogIn(opt: {provider: ProviderName, type: "popup" | "redirect"}) {
		const providerClass = GetProviderClassForName(opt.provider);
		let provider = new (providerClass as any)();
		
		let credential: firebase.auth.UserCredential|undefined;
		if (opt.type == "popup") {
			credential = await firebase.auth().signInWithPopup(provider);
		} else if (opt.type == "redirect") {
			await firebase.auth().signInWithRedirect(provider);
			//credential = await firebase.auth().getRedirectResult(); // not sure if this works
		}
		// we don't need to do anything with the user-info; it's handled by the listener in InitSubs()
		//console.log("Raw user info:", rawUserInfo);
		return credential;
	}
	async LogIn_WithCredential(opt: {provider: ProviderName, idToken?: string, accessToken?: string}) {
		const providerClass = GetProviderClassForName(opt.provider);
		let credential = await firebase.auth().signInWithCredential(providerClass.credential(opt.idToken || null, opt.accessToken));
		return credential;
	}
	async LogOut() {
		await firebase.auth().signOut();
	}

	tree: TreeNode<DBShape>;
	treeRequestWatchers = new Set<TreeRequestWatcher>();
	//pathSubscriptions: Map<string, PathSubscription>;
	UnsubscribeAll() {
		this.tree.UnsubscribeAll();
	}

	ValidateDBData?: (dbData: DBShape)=>void;
}

export type ProviderName = "google" | "facebook" | "twitter" | "github";
const providerClasses = {
	google: firebase.auth.GoogleAuthProvider,
	facebook: firebase.auth.FacebookAuthProvider,
	twitter: firebase.auth.TwitterAuthProvider,
	//github: firebase.auth.GithubAuthProvider,
};
function GetProviderClassForName(providerName: ProviderName): firebase.auth.OAuthProvider {
	return providerClasses[providerName];
}