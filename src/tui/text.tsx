import React from "react";
import { Text as InkText, type TextProps as InkTextProps } from "ink";

export interface TextProps extends Omit<InkTextProps, "color" | "backgroundColor"> {
  color?: string | undefined;
  backgroundColor?: string | undefined;
}

export function Text({ color, backgroundColor, ...props }: TextProps) {
  return (
    <InkText
      {...(color !== undefined ? { color } : {})}
      {...(backgroundColor !== undefined ? { backgroundColor } : {})}
      {...props}
    />
  );
}
