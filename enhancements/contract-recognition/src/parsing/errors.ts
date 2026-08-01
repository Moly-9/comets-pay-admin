import type { ParseErrorCode } from "../types";

export class ContractParseError extends Error {
  readonly code: ParseErrorCode;

  constructor(code: ParseErrorCode, message: string) {
    super(message);
    this.name = "ContractParseError";
    this.code = code;
  }
}
