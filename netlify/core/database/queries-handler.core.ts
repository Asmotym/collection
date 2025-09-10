import { HandlerEvent, HandlerResponse } from "@netlify/functions";
import { sql } from '.';

export class QueryHandler {
    private event: HandlerEvent;
    private queryType: string;
    
    constructor(event: HandlerEvent) {
        this.event = event;
    }

    public async handle(): Promise<HandlerResponse> {
        if (this.event.httpMethod === 'OPTIONS') return this.returnOptionsResponse();

        try {
            if (this.event.httpMethod === 'POST' && typeof this.event.body === 'string') {
                const body = JSON.parse(this.event.body);
                this.queryType = body.queryType || '-';
            }

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    success: true,
                    data: await this.getQueryResults(),
                    queryType: this.queryType,
                }),
            };
        } catch (error) {
            return this.returnErrorResponse(error instanceof Error ? error : new Error('Unknown error'));
        }
    }

    protected async getAll() {
        const result = await sql`SELECT c.id, art.id as artist_id, art.name as artist_name, alb.id as album_id, alb.name as album_name, alb.year as album_year, alb.image as album_image FROM collection c JOIN artist art ON c.artist_id = art.id JOIN album alb ON c.album_id = alb.id`;
        console.log(result)
        return result;
    }

    protected async getQueryResults() {
        switch (this.queryType) {
            case 'collection':
                return await this.getAll();
        }
    }

    protected returnOptionsResponse(): HandlerResponse {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
            },
        };
    }

    protected returnErrorResponse(error: Error): HandlerResponse {
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: false,
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }

    protected returnParseErrorResponse(): HandlerResponse {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: false,
                error: 'Invalid JSON in request body'
            })
        };
    }
}