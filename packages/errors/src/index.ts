import { Code, ConnectError } from "@connectrpc/connect";

export class DomainError extends Error {
  readonly code: Code;
  constructor(code: Code, message: string) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;
  }
  toConnect(): ConnectError {
    return new ConnectError(this.message, this.code);
  }
}

export class NotFound extends DomainError {
  constructor(what: string) { super(Code.NotFound, `${what} not found`); }
}

export class AlreadyExists extends DomainError {
  constructor(what: string) { super(Code.AlreadyExists, `${what} already exists`); }
}

export class InvalidArgument extends DomainError {
  constructor(reason: string) { super(Code.InvalidArgument, reason); }
}

export class Unauthenticated extends DomainError {
  constructor(reason = "unauthenticated") { super(Code.Unauthenticated, reason); }
}

export class PermissionDenied extends DomainError {
  constructor(reason: string) { super(Code.PermissionDenied, reason); }
}

export class FailedPrecondition extends DomainError {
  constructor(reason: string) { super(Code.FailedPrecondition, reason); }
}

export class Internal extends DomainError {
  constructor(reason: string) { super(Code.Internal, reason); }
}

export { Code, ConnectError };
