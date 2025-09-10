import { Handler } from '@netlify/functions';
import { QueryHandler } from '../core/database';

export const handler: Handler = async (event) => {
    const queryHandler = new QueryHandler(event);
    return await queryHandler.handle();
};