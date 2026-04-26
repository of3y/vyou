import React from "react";
import { tokens } from "../../tokens";

export type HairlineProps = {
  margin?: number;
  strong?: boolean;
};

export const Hairline: React.FC<HairlineProps> = ({
  margin = 64,
  strong = false,
}) => (
  <div
    style={{
      height: 1,
      background: strong ? tokens.hairlineStrong : tokens.hairline,
      margin: `${margin}px 0`,
      width: "100%",
    }}
  />
);
