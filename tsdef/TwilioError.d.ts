export class TwilioError extends Error {
  code: number;
  toString(): string;
}
