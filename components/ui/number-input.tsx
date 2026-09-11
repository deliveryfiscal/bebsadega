"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";

type NativeProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step">;

export type NumberInputProps = NativeProps & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  emptyWhenZero?: boolean;
};

function displayNumber(value: number, integer: boolean) {
  if (!Number.isFinite(value)) return "";
  const normalized = integer ? Math.trunc(value) : value;
  return String(normalized).replace(".", ",");
}

function parseNumber(raw: string, integer: boolean) {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return integer ? Math.trunc(parsed) : parsed;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput({
  value,
  onValueChange,
  min,
  max,
  step,
  integer: integerProp,
  emptyWhenZero = true,
  onFocus,
  onBlur,
  inputMode,
  ...props
}, forwardedRef) {
  const integer = integerProp ?? (step === 1);
  const [text, setText] = useState(() => value === 0 && emptyWhenZero ? "" : displayNumber(value, integer));
  const focusedRef = useRef(false);

  const safeValue = useMemo(() => {
    let next = Number.isFinite(value) ? value : 0;
    if (typeof min === "number") next = Math.max(min, next);
    if (typeof max === "number") next = Math.min(max, next);
    return integer ? Math.trunc(next) : next;
  }, [value, min, max, integer]);

  useEffect(() => {
    if (focusedRef.current) return;
    setText(safeValue === 0 && emptyWhenZero ? "" : displayNumber(safeValue, integer));
  }, [safeValue, integer, emptyWhenZero]);

  const commit = (raw: string) => {
    let next = parseNumber(raw, integer);
    if (next === null) next = typeof min === "number" && min > 0 ? min : 0;
    if (typeof min === "number") next = Math.max(min, next);
    if (typeof max === "number") next = Math.min(max, next);
    if (integer) next = Math.trunc(next);
    onValueChange(next);
    setText(next === 0 && emptyWhenZero ? "" : displayNumber(next, integer));
  };

  return <input
    {...props}
    ref={forwardedRef}
    type="text"
    inputMode={inputMode || (integer ? "numeric" : "decimal")}
    value={text}
    onFocus={(event) => {
      focusedRef.current = true;
      if (safeValue === 0 && emptyWhenZero) setText("");
      else window.setTimeout(() => event.currentTarget.select(), 0);
      onFocus?.(event);
    }}
    onBlur={(event) => {
      focusedRef.current = false;
      commit(text);
      onBlur?.(event);
    }}
    onChange={(event) => {
      const nextText = event.target.value;
      const pattern = integer ? /^-?\d*$/ : /^-?\d*(?:[.,]\d*)?$/;
      if (!pattern.test(nextText)) return;
      setText(nextText);
      const parsed = parseNumber(nextText, integer);
      if (parsed === null) return;
      let next = parsed;
      if (typeof min === "number") next = Math.max(min, next);
      if (typeof max === "number") next = Math.min(max, next);
      onValueChange(next);
    }}
  />;
});
