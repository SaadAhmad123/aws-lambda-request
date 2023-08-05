import { RestRequest, RestRequestError } from './RestRequest';
import { FieldType, Schema, ValueField } from './Schema';

describe('RestRequest', () => {
    const requestSchema = new Schema({
        foo: new ValueField(FieldType.String, true)
    });

    const responseSchema = new Schema({
        bar: new ValueField(FieldType.String, true)
    });

    const handler = jest.fn().mockResolvedValue({ bar: 'baz' });

    const restRequest = new RestRequest({
        urlPath: '/some_url',
        namespace: 'Test API',
        methods: ['POST'],
        schema: { request: requestSchema, response: responseSchema },
        handler,
    });

    beforeEach(() => {
        handler.mockClear();
    });

    it('should successfully handle a valid request', async () => {
        const requestInput = {
            body: { foo: 'value' },
            headers: {},
            method: 'POST',
        };
        const response = await restRequest.handle(requestInput);
        expect(response.statusCode).toBe(200);
        expect(response.body).toBe(JSON.stringify({ bar: 'baz' }));
    });

    it('should return 405 for an invalid method', async () => {
        const requestInput = {
            body: { foo: 'value' },
            headers: {},
            method: 'GET',
        };
        const response = await restRequest.handle(requestInput);
        expect(response.statusCode).toBe(405);
    });

    it('should return 400 for an invalid request body', async () => {
        const requestInput = {
            body: { wrongKey: 'value' },
            headers: {},
            method: 'POST',
        };
        const response = await restRequest.handle(requestInput);
        expect(response.statusCode).toBe(400);
    });

    it('should return 500 for a handler failure', async () => {
        handler.mockRejectedValue(new RestRequestError('Internal Error'));
        const requestInput = {
            body: { foo: 'value' },
            headers: {},
            method: 'POST',
        };
        const response = await restRequest.handle(requestInput);
        expect(response.statusCode).toBe(500);
    });

    it('should generate a valid OpenAPI 3.0 schema', () => {
        const schema = restRequest.jsonSchema();
        expect(schema).toHaveProperty('openapi', '3.0.0');
        expect(schema.paths['/some_url']).toHaveProperty('post');
    });
});
