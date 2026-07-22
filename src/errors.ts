export type SuperbirdErrorCode =
  | 'not-found'
  | 'wrong-mode'
  | 'usb'
  | 'timeout'
  | 'invalid-operation'
  | 'bulkcmd-failed'
  | 'config';

export class SuperbirdError extends Error {
  constructor(
    readonly code: SuperbirdErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'SuperbirdError';
  }
}

export function invalidOperation(message: string): SuperbirdError {
  return new SuperbirdError('invalid-operation', message);
}
