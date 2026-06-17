// Allow CSS module imports in strict TypeScript
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}
