declare module "react-world-flags" {
  import type { ComponentType, ReactNode } from "react";

  interface FlagProps {
    code: string;
    className?: string;
    fallback?: ReactNode;
  }

  const Flag: ComponentType<FlagProps>;
  export default Flag;
}
