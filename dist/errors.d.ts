export type SuperbirdErrorCode = 'not-found' | 'wrong-mode' | 'usb' | 'timeout' | 'invalid-operation' | 'bulkcmd-failed' | 'config';
export declare class SuperbirdError extends Error {
    readonly code: SuperbirdErrorCode;
    constructor(code: SuperbirdErrorCode, message: string, options?: ErrorOptions);
}
export declare function invalidOperation(message: string): SuperbirdError;
//# sourceMappingURL=errors.d.ts.map