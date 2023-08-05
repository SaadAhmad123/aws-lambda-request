# AWS Lambda Request Package

The AWS Lambda Request package is designed to facilitate the creation, validation, and handling of RESTful API requests. This package also includes the `Schema` class to define validation schemas for both requests and responses.

## Installation

You can install this package from npm by running the following command:

```bash
npm install aws-lambda-request
```

## Features

- **Encapsulated Logic**: All the logic required for processing and responding to RESTful API requests are encapsulated within the classes.
- **Reusable and Testable**: Provides a clean, reusable, and testable interface for handling requests.
- **Request and Response Validation**: Validates incoming requests and outgoing responses against defined Schemas.
- **Method Type Checking**: Handles HTTP method type checking, error catching, and default response headers, including CORS.
- **OpenAPI Schema Generation**: Generates OpenAPI 3.0 compliant JSON schema representing the REST request.

## Usage

### Schema Class

The `Schema` class is used to define a validation schema for request and response data.

```typescript
import { Schema, ValueField, FieldType } from 'aws-lambda-request';

const userSchema = new Schema({
  name: new ValueField(FieldType.String, true),
  age: new ValueField(FieldType.String, true),
});
```

### RestRequest Class

The `RestRequest` class is used to manage the processing of HTTP requests and responses.

```typescript
import { RestRequest, Schema } from 'aws-lambda-request';

const requestSchema = new Schema({...});
const responseSchema = new Schema({...});

const restRequest = new RestRequest({
    namespace: "The Credit API",
    urlPath: "/some_url",
    methods: ['POST', 'GET'],
    schema: { request: requestSchema, response: responseSchema },
    handler: async (data) => { return processedData; }
});

const response = await restRequest.handle(requestInput);
```

You can also generate an OpenAPI compliant JSON schema using the `jsonSchema` method:

```typescript
const openApiSchema = restRequest.jsonSchema();
```

## Example

An example use-case might be validating user creation in an API:

```typescript
import {
  RestRequest,
  Schema,
  ValueField,
  FieldType,
  DictField,
} from 'aws-lambda-request';

const requestSchema = new Schema({
  username: new ValueField(FieldType.String, true), // required
  password: new ValueField(FieldType.String, true), // reqired
  user_config: new DictField(
    {
      first_name: new ValueField(FieldType.String, false), // optional
      last_name: new ValueField(FieldType.String, false), // optional
    },
    false,
  ),
});

const responseSchema = new Schema({
  userId: new ValueField(
    FieldType.String,
    true,
    'The user id of the created user',
  ),
});

const createUserRequest = new RestRequest({
  namespace: 'User API',
  urlPath: '/create_user',
  methods: ['POST'],
  schema: { request: requestSchema, response: responseSchema },
  handler: async (data) => {
    // Logic to create user
    return { userId: 'some_user_id' };
  },
});

export async function handler(event: any) {
  return await createUserRequest.handle({
    method: 'POST',
    body: event.body || {},
    headers: event.headers || {},
  });
}
```

## Documentation

For more detailed information on available methods and their usage, please refer to the API documentation included with the package.

## Support

For issues, feature requests, or general inquiries, please [open an issue](https://github.com/username/aws-lambda-request/issues) on GitHub.

## License

This project is licensed under the [MIT License](./License.md). See the LICENSE file for details.
