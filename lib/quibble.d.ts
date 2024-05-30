type QuibbleConfig = {
  defaultFakeCreator: (request: string) => any;
};

declare const quibble: ((request: string, stub?: any) => any) & {
  config(userConfig: Partial<QuibbleConfig>): QuibbleConfig;
  ignoreCallsFromThisFile(file?: string): void;
  reset(hard?: boolean): void;
  absolutify(relativePath: string, parentFileName?: string): string;
  esm(
    specifier: string,
    namedExportStubs?: Record<string, any>,
    defaultExportStub?: any
  ): Promise<void>;
  listMockedModules(): string[];
  isLoaderLoaded(): boolean;
  esmImportWithPath(specifier: string): Promise<{
    modulePath: string;
    moduleUrl: string;
    module: any;
  }>;
};

export default quibble;
