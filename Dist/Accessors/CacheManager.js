export function GetAccessorCache(accessor, mobxCacheOpts) {
    if (!accessorCaches.has(accessor)) {
        accessorCaches.set(accessor, new AccessorCache(accessor, mobxCacheOpts));
    }
    return accessorCaches.get(accessor);
}
