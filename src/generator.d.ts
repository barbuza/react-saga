declare module _IsGeneratorFunction {
  function isGeneratorFunction(fun: any): Boolean;
}
declare module 'is-generator-function' {
  export default _IsGeneratorFunction.isGeneratorFunction;
}

declare interface RegeratorRuntime {
  isGeneratorFunction(fun: any): Boolean;
}

declare var regeneratorRuntime: RegeratorRuntime;
