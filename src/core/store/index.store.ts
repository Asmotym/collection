import { useCollectionStore } from "./stores/collection.store";
import { useCategoryStore } from './stores/category.store';

export const store = {
    collection: useCollectionStore,
    category: useCategoryStore,
}
