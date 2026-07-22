export class SuperbirdError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.code = code;
        this.name = 'SuperbirdError';
    }
}
export function invalidOperation(message) {
    return new SuperbirdError('invalid-operation', message);
}
//# sourceMappingURL=errors.js.map