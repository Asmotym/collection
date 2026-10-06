import * as collectionApi from './routes/collection.routes';
import * as categoryApi from './routes/category.routes';
import * as userApi from './routes/user.routes';

export const api = {
    collection: collectionApi,
    category: categoryApi,
    user: userApi,
}
