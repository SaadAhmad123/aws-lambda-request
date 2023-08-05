import { Schema } from './Schema';
import { v4 as uuidv4 } from 'uuid'

/**
 * Input type definition for a request handler function.
 *
 * @property {any} body - The body content of the request.
 * @property {Record<string, any>} headers - A dictionary of headers contained within the request.
 * @property {string} method - The HTTP method used for the request.
 */
type RequestHandlerInput = {
  body: any;
  headers: Record<string, any>;
  method: string;
};

/**
 * Output type definition for a request handler function.
 *
 * @property {number} statusCode - The HTTP status code for the response.
 * @property {string} body - The response body content as a string.
 * @property {Record<string, any>} headers - A dictionary of headers to include in the response.
 */
type RequestHandlerOutput = {
  statusCode: number;
  body: string;
  headers: Record<string, any>;
};

/**
 * Class representing a REST request error.
 * Extends the native Error class.
 */
export class RestRequestError extends Error {
  status: number;

  /**
   * @param {string} message - The original error message.
   * @param {number} status - The HTTP status code.
   */
  constructor(message: string, status: number = 500) {
    super(message);
    this.status = status;
  }
}

/**
 * Class representing a REST request. The RestRequest class is designed to manage
 * the processing of HTTP requests and responses. It includes validation, error handling,
 * and formatting of both requests and responses.
 *
 * Why:
 *   - To encapsulate the logic required for processing and responding to RESTful API requests.
 *   - To provide a clean, reusable, and testable interface for handling requests.
 *
 * What:
 *   - Validates incoming requests and outgoing responses against defined Schemas.
 *   - Handles HTTP method type checking, error catching, and default response headers including CORS.
 *   - Utilizes custom handler functions to process the request.
 *
 * Usage:
 *   ```typescript
 *   const requestSchema = new Schema({...});
 *   const responseSchema = new Schema({...});
 *   const restRequest = new RestRequest({
 *       namespace: "The Credit API"
 *       urlPath: "/some_url"
 *       description: "Some api url description"
 *       methods: ['POST', 'GET'],
 *       schema: { request: requestSchema, response: responseSchema },
 *       handler: async (data) => { return processedData; }
 *   });
 *   const response = await restRequest.handle(requestInput);
 *   ```
 */
export class RestRequest {
  private namespace: string;
  private urlPath: string;
  private description: string;
  private methods: string[];
  private responseHeader: Record<string, any>;
  private schema: {
    request: Schema;
    response: Schema;
  };
  private handlerFunc: (data: any) => Promise<any>;
  private loggerFunc: (
    data: any,
    type: 'error' | 'success' | 'warning' | 'log',
  ) => void;

  /**
   * Constructs a RestRequest instance.
   * @param {Object} config - The configuration object.
   * @param {string} config.namespace - The common namespace of the RestRequests
   * @param {string} config.urlPath - The url path of the RestRequests
   * @param {string} [config.description] - The rest request description
   * @param {string[]} [config.methods] - Optional. Allowed HTTP method types (e.g., 'GET', 'POST'). Default is an empty array, allowing all types.
   * @param {Object} config.schema - The Schema object for the request and response validation.
   * @param {Schema} config.schema.request - Schema to validate request data.
   * @param {Schema} config.schema.response - Schema to validate response data.
   * @param {Record<string, any>} [config.responseHeader] - Optional. Additional response headers to override or extend default headers.
   * @param {(data: any) => Promise<any>} config.handler - The handler function to process request data and return a response. Must return a Promise.
   * @param {(data: any, type: 'error' | 'success' | 'warning' | 'log') => void} [config.logger] - The handler function to print the logs.
   */
  constructor(config: {
    description?: string;
    urlPath: string;
    namespace: string;
    methods?: string[];
    schema: {
      request: Schema;
      response: Schema;
    };
    responseHeader?: Record<string, any>;
    handler: (data: any) => Promise<any>;
    logger?: (data: any, type: 'error' | 'success' | 'warning' | 'log') => void;
  }) {
    this.description = config.description || 'No description available';
    this.methods = config.methods || [];
    this.urlPath = config.urlPath;
    this.namespace = config.namespace;
    this.schema = config.schema;
    this.handlerFunc = config.handler;
    this.loggerFunc =
      config.logger ||
      ((data: any, type: 'error' | 'success' | 'warning' | 'log') => {
        type === 'error' && console.log(data);
      });
    this.responseHeader = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Content-Type': 'application/json',
      ...(config?.responseHeader || {}),
    };
  }

  /**
   * Private method to handle the request excluding headers. This method performs validation and calls the handler function.
   *
   * @private
   * @param {Omit<RequestHandlerInput, "headers">} event - The request event excluding headers.
   * @param {string} trackId - The track id to track the call
   * @returns {Promise<Omit<RequestHandlerOutput, "headers">>} The response object excluding headers.
   */
  private async handleRequest(
    event: Omit<RequestHandlerInput, 'headers'>,
    trackId: string
  ): Promise<Omit<RequestHandlerOutput, 'headers'>> {
    if (this.methods.length > 0 && !this.methods.includes(event.method)) {
      const body = { message: 'Method not allowed' };
      this.loggerFunc({ 'x-track-id': trackId, body, __type: "request_method_validation_error" }, 'error');
      return {
        statusCode: 405,
        body: JSON.stringify(body),
      };
    }

    try {
      this.schema.request.validate(event.body);
    } catch (error) {
      const body = {
        message: `Invalid request body. ${(error as Error).message}`,
      };
      this.loggerFunc({ 'x-track-id': trackId, body, __type: "request_input_validation_error" }, 'error');
      return {
        statusCode: 400,
        body: JSON.stringify(body),
      };
    }

    try {
      let result: any = {};
      try {
        this.loggerFunc({ 'x-track-id': trackId, body: event.body, __type: "request_input" }, 'log');
        result = await this.handlerFunc(event.body);
      } catch (error) {
        throw new RestRequestError((error as Error).message, 500);
      }

      const validatedResult = this.schema.response
        .validate(result)
        .fullDataObject();

      this.loggerFunc({ 'x-track-id': trackId, validatedResult, __type: "request_response" }, 'log');
      return {
        statusCode: 200,
        body: JSON.stringify(validatedResult),
      };
    } catch (error) {
      if (error instanceof RestRequestError) {
        const body = { message: error.message };
        this.loggerFunc({ 'x-track-id': trackId, body, __type: "request_handler_error" }, 'error');
        return {
          statusCode: error.status,
          body: JSON.stringify(body),
        };
      }
      const body = {
        message: `Invalid response. ${(error as Error).message || 'Internal server error'
          }`,
      };
      this.loggerFunc({ 'x-track-id': trackId, body, __type: "request_response_resolution_error" }, 'error');
      return {
        statusCode: 500,
        body: JSON.stringify(body),
      };
    }
  }

  /**
   * Public method to handle the request including headers. Calls `handleRequest` internally and adds response headers.
   *
   * @param {RequestHandlerInput} event - The request event including headers.
   * @param {string} [trackId] - The track id to track the call
   * @returns {Promise<RequestHandlerOutput>} The response object including headers.
   */
  async handle(event: RequestHandlerInput, trackId: string = uuidv4().toString()): Promise<RequestHandlerOutput> {
    return {
      ...(await this.handleRequest(event, trackId)),
      headers: {
        ...(this.responseHeader || {}),
        ...(event.headers || {}),
        'x-req-track-id': trackId
      },
    };
  }

  /**
   * Generates an OpenAPI 3.0.0 compliant JSON schema representing the REST request.
   *
   * The resulting schema includes details about the URL, allowed HTTP methods,
   * request parameters or body, and standard response formats for successful requests
   * and common errors such as '400 Bad Request', '405 Method Not Allowed', and '500 Internal Server Error'.
   *
   * For GET methods, parameters are extracted from the request schema and treated as query parameters.
   * For other HTTP methods, the request schema is treated as the request body.
   *
   * @returns {Object} An OpenAPI 3.0 compliant JSON schema object describing the REST request.
   *
   * @example
   * const restRequest = new RestRequest({...});
   * const openApiSchema = restRequest.jsonSchema();
   */
  public jsonSchema() {
    const errorResponse = {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    };
    const responses = {
      '200': {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: this.schema.response.jsonSchema(),
          },
        },
      },
      '400': { description: 'Invalid request body', content: errorResponse },
      '405': { description: 'Method not allowed', content: errorResponse },
      '500': { description: 'Internal server error', content: errorResponse },
    };

    const methods = this.methods.reduce((acc, method) => {
      const operation: any = {
        description: this.description,
        responses,
      };

      if (method === 'GET') {
        operation.parameters = Object.keys(
          this.schema.request.jsonSchema().properties,
        ).map((key) => ({
          name: key,
          in: 'query',
          schema: {
            type: this.schema.request.jsonSchema().properties[key].type,
          },
        }));
      } else {
        operation.requestBody = {
          content: {
            'application/json': {
              schema: this.schema.request.jsonSchema(),
            },
          },
        };
      }
      return {
        ...acc,
        [method.toLowerCase()]: operation,
      };
    }, {});

    return {
      openapi: '3.0.0',
      info: {
        title: this.namespace,
        version: '1.0.0',
      },
      paths: {
        [this.urlPath]: methods,
      },
    };
  }
}
