declare global {
    interface Window {
      JsPsychMetadata: new () => JsPsychMetadataInstance;
    }
  }
  
  interface JsPsychMetadataInstance {
    generate: (data: any, metadataOptions?: object, csv?: boolean) => void;
    getMetadata: () => object;
  }
  
  export {};