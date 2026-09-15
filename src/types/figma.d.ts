/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "figma" {
  const figma: any;
  export default figma;
}

declare module "react-dom/client" {
  export interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}
