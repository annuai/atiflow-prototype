/** The shape a translation must have: the same keys as the English catalog, text for text, function for function (same parameters). */
export type Messages<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Messages<R>
    : T extends readonly (infer U)[]
      ? readonly Messages<U>[]
      : { -readonly [K in keyof T]: Messages<T[K]> };
