declare global {
    interface Window {
      JsPsychMetadata: new () => JsPsychMetadataInstance;
    }
  }
  
  interface JsPsychMetadataInstance {
    generate: (data: unknown[] | string, metadataOptions?: object, csv?: boolean) => void;
    getMetadata: () => object;
  }
  
  export {};