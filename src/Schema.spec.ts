import {
    ValueField,
    ListField,
    DictField,
    Schema,
    FieldType,
} from './Schema'; // Update the import path

describe('ValueField', () => {
    it('should validate a string value', () => {
        const field = new ValueField(FieldType.String);
        expect(field.validate('test')).toBeUndefined();
        expect(field.validate(123)).toEqual('Expected string, got number. Field description: No description available');
    });
});

describe('ListField', () => {
    it('should validate a list of numbers', () => {
        const field = new ListField(new ValueField(FieldType.Number));
        expect(field.validate([1, 2, 3])).toBeUndefined();
        expect(field.validate(['1', '2', '3'])).toEqual('In list: Expected number, got string. Field description: No description available. List description: No description available');
    });
});

describe('DictField', () => {
    it('should validate an object', () => {
        const field = new DictField({
            name: new ValueField(FieldType.String, true),
            age: new ValueField(FieldType.Number),
        });
        expect(field.validate({ name: 'John', age: 30 })).toBeUndefined();
        expect(field.validate({ name: 123, age: 30 })).toEqual('In property name: Expected string, got number. Field description: No description available. Object description: No description available');
    });
});

describe('Schema', () => {
    it('should validate a complex object', () => {
        const userSchema = new Schema({
            name: new ValueField(FieldType.String, true),
            age: new ValueField(FieldType.Number, true),
            address: new DictField({
                street: new ValueField(FieldType.String, true, 'Street Address'),
                city: new ValueField(FieldType.String),
            }),
        });

        expect(() => userSchema.validate({
            name: 'John',
            age: 30,
            address: { street: '123 Main St', city: 'Anywhere' },
        })).not.toThrow();

        expect(() => userSchema.validate({
            name: 'John',
            age: '30',
            address: { street: '123 Main St', city: 'Anywhere' },
        })).toThrow(/In property age/);
    });
});
