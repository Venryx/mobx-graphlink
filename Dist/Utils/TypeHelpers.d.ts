export declare type NoID<T> = Omit<T, "id"> & {
    id?: string;
};
