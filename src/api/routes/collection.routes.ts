import { ApiClient } from "../client.api";
import type { CollectionItem } from "core/store/stores/collection.store";

export async function getAll() {
    return await ApiClient.request<CollectionItem[]>('/collection');
}
