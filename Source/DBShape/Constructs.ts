import {ObservableMap} from "mobx";

export type Collection_Closed<T> = T;
export type Collection<T> = ObservableMap<string, T>;