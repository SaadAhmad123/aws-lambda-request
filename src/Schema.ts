/**
 * Enum representing the valid types for fields.
 * These types align with the standard JSON data types.
 */
export enum FieldType {
  String = 'string',
  Number = 'number',
  Object = 'object',
  Array = 'array',
  Boolean = 'boolean',
  Null = 'null',
}

/**
 * Interface representing a generic schema.
 */
export interface ISchema {
  type: string;
  properties?: Record<string, ISchema>;
  items?: ISchema;
  required?: string[];
  description?: string;
}

/**
 * Abstract class representing a field.
 * Contains methods for validating and retrieving the schema of a field.
 */
export abstract class Field<T> {
  required: boolean = false;
  description: string = 'No description available';

  /**
   * Constructs a field.
   * @param required - Specifies whether the field is required.
   * @param description - Specifies field description.
   */
  constructor(required?: boolean, description?: string) {
    if (required) this.required = required;
    if (description) this.description = description;
  }

  /**
   * Validates a value against the field definition.
   * @param value - The value to validate.
   * @returns A string error message if validation fails, or undefined if successful.
   */
  abstract validate(value: T): string | undefined;

  /**
   * Returns the schema for the field.
   * @returns An object representing the schema.
   */
  abstract schema(): ISchema;
}

/**
 * Class representing a simple value field.
 * Extends the Field class to handle simple value validation.
 */
export class ValueField<T> extends Field<T> {
  type: FieldType;

  /**
   * Constructs a ValueField.
   * @param type - The expected type of the value.
   * @param required - Specifies whether the field is required.
   * @param description - Specifies field description.
   */
  constructor(type: FieldType, required?: boolean, description?: string) {
    super(required, description);
    this.type = type;
  }

  /**
   * @inheritdoc
   */
  validate(value: T): string | undefined {
    if (!this.required && !value) {
      return;
    }
    if (typeof value !== this.type) {
      return `Expected ${this.type}, got ${typeof value}. Field description: ${
        this.description
      }`;
    }
  }

  /**
   * @inheritdoc
   */
  schema(): ISchema {
    return { type: this.type, description: this.description };
  }
}

/**
 * Class representing a list field.
 * Extends the Field class to handle array validation.
 */
export class ListField<T> extends Field<T[]> {
  items: Field<T>;

  /**
   * Constructs a ListField.
   * @param items - The field definition for the items within the list.
   * @param required - Specifies whether the field is required.
   * @param description - Specifies field description.
   */
  constructor(items: Field<T>, required?: boolean, description?: string) {
    super(required, description);
    this.items = items;
  }

  /**
   * @inheritdoc
   */
  validate(value: T[]): string | undefined {
    if (this.required && !Array.isArray(value)) {
      return `Expected a list, got ${typeof value}. Field description: ${
        this.description
      }`;
    }
    if (!this.required && !value) {
      return;
    }
    for (const item of value) {
      const error = this.items.validate(item);
      if (error) {
        return `In list: ${error}. List description: ${this.description}`;
      }
    }
  }

  /**
   * @inheritdoc
   */
  schema(): ISchema {
    return {
      type: 'array',
      items: this.items.schema(),
      description: this.description,
    };
  }
}

/**
 * Class representing an object field (dictionary).
 * Extends the Field class to handle object validation.
 */
export class DictField extends Field<Record<string, any>> {
  fields: Record<string, Field<any>>;

  /**
   * Constructs a DictField.
   * @param fields - A mapping of field names to field definitions for the object properties.
   * @param required - Specifies whether the field is required.
   * @param description - Specifies field description.
   */
  constructor(
    fields: Record<string, Field<any>>,
    required?: boolean,
    description?: string,
  ) {
    super(required, description);
    this.fields = fields;
  }

  /**
   * @inheritdoc
   */
  validate(value: Record<string, any>): string | undefined {
    if (this.required && (typeof value !== 'object' || Array.isArray(value))) {
      return `Expected an key-value object, got ${typeof value}. Field description: ${
        this.description
      }`;
    }
    if (!this.required && !value) {
      return;
    }
    for (const key in this.fields) {
      const error = this.fields[key].validate(value[key]);
      if (error) {
        return `In property ${key}: ${error}. Object description: ${this.description}`;
      }
    }
  }

  /**
   * @inheritdoc
   */
  schema(): ISchema {
    const properties: Record<string, ISchema> = {};
    const required: string[] = [];

    for (const key in this.fields) {
      const field = this.fields[key];
      properties[key] = field.schema();
      if (field.required) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      description: this.description,
      required,
    };
  }
}

/**
 * Class representing a schema for validating objects.
 *
 * This class is responsible for constructing a schema definition using the given field definitions.
 * It also provides a method for validating an object against the schema.
 *
 * **Algorithm:**
 * 1. The constructor takes in field definitions and creates an internal schema representation.
 * 2. The `validate` method iterates through the fields in the provided object and calls the corresponding
 *    field's validate method.
 * 3. If validation fails at any point, an error message is returned, detailing the failure.
 *
 * **Example Usage:**
 * ```typescript
 * const userSchema = new Schema({
 *   name: new ValueField(FieldType.String, true),
 *   age: new ValueField(FieldType.Number, true),
 *   address: new DictField({
 *     street: new ValueField(FieldType.String, true, "Street Address"),
 *     city: new ValueField(FieldType.String),
 *   })
 * });
 *
 * const error = userSchema.validate({
 *   name: 'John',
 *   age: 30,
 *   address: { street: '123 Main St', city: 'Anywhere' }
 * });
 *
 * if (error) {
 *   console.error('Validation failed:', error);
 * } else {
 *   console.log('Validation successful!');
 * }
 *
 * console.log(JSON.stringify(userSchema.jsonSchema(), null, 2))
 * console.log(userSchema.data().name)
 * ```
 */
export class Schema {
  private _schema: ISchema;
  private _fields: Record<string, Field<any>>;
  private _data: Record<string, any> | undefined;

  /**
   * Constructs a Schema with the given field definitions.
   * @param fields - A mapping of field names to field definitions for the schema properties.
   * @param description - The schema description
   */
  constructor(fields: Record<string, Field<any>>, description?: string) {
    const properties: Record<string, ISchema> = {};
    const required: string[] = [];

    for (const key in fields) {
      const field = fields[key];
      properties[key] = field.schema();
      if (field.required) {
        required.push(key);
      }
    }

    this._schema = {
      type: 'object',
      properties,
      required,
      description: description || 'No schema descripton available',
    };

    this._fields = fields;
  }

  /**
   * Validates an object against the schema, checking each field's value against its definition.
   * @param data - The object to validate.
   * @returns The schema object itself
   */
  validate(data: Record<string, any>): Schema {
    for (const key in this._fields) {
      const error = this._fields[key].validate(data[key]);
      if (error) {
        throw new Error(`In property ${key}: ${error}`);
      }
    }
    this._data = data;
    return this;
  }

  /**
   * Converts the internal schema to OpenAPI 3.1 format and returns it as JSON.
   *
   * The OpenAPI 3.0.0 format is a standard for describing the structure of APIs, including
   * request and response specifications. This method takes the internal schema representation
   * and translates it to a JSON object that conforms to OpenAPI 3.1.
   *
   * @returns A JSON object representing the schema in OpenAPI 3.1 format.
   */
  jsonSchema(): Record<string, any> {
    // Assuming that the internal schema representation is compatible with OpenAPI 3.1
    // You may need to add additional transformations here if your internal schema
    // differs from the OpenAPI 3.1 structure.
    return this._schema;
  }

  /**
   * Returns a proxy object that provides access to the actual values of the fields
   * validated by the last call to `validate`.
   *
   * @throws {Error} Throws an error if the accessed property does not exist in the schema
   *                 or if `validate` has not been called first.
   * @returns A proxy object to access actual values within the schema.
   */
  data(): any {
    if (!this._data) {
      throw new Error(
        'Must call an error free <Schema>.validate(data) before accessing data. Either the data is not valid or validate() is not called.',
      );
    }
    return new Proxy(
      {},
      {
        get: (target, prop) => {
          if (!(prop in this._data!)) {
            throw new Error(
              `Property ${String(prop)} does not exist in the schema.`,
            );
          }
          return this._data![prop as string];
        },
      },
    );
  }

  /**
   * Returns the full data object that was successfully validated against the schema.
   *
   * Unlike the `data` method, which returns a proxy object allowing access to individual properties of the validated data,
   * `fullDataObject` returns the entire data object itself. Use this method when you need to retrieve or manipulate the
   * entire validated data object rather than accessing specific properties.
   *
   * Use `data` method if you want controlled access to individual properties and want to ensure that accessed properties exist
   * within the schema.
   *
   * @throws {Error} Throws an error if the data is not valid or if the `validate` method has not been called.
   * @returns The full data object.
   */
  fullDataObject(): any {
    if (!this._data) {
      throw new Error(
        'Must call an error free <Schema>.validate(data) before accessing data. Either the data is not valid or validate() is not called.',
      );
    }
    return { ...this._data };
  }

  /**
   * Clears the internally stored data that has been previously validated.
   *
   * This method is useful in scenarios where you may want to re-use the same Schema instance to validate
   * multiple different data objects in sequence, and you want to ensure that any previously stored
   * validated data is cleared out between validations.
   */
  clear() {
    this._data = undefined;
  }
}
