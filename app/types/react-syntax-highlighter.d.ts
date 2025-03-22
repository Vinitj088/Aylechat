declare module 'react-syntax-highlighter' {
  import * as React from 'react';
  
  export const Prism: React.ComponentType<any>;
  export const Light: React.ComponentType<any>;
  
  export interface SyntaxHighlighterProps {
    language?: string;
    style?: any;
    children?: React.ReactNode;
    customStyle?: any;
    codeTagProps?: React.HTMLAttributes<HTMLElement>;
    useInlineStyles?: boolean;
    showLineNumbers?: boolean;
    startingLineNumber?: number;
    lineNumberStyle?: any;
    wrapLines?: boolean;
    lineProps?: any;
    renderer?: any;
    PreTag?: React.ComponentType<any>;
    CodeTag?: React.ComponentType<any>;
    [key: string]: any;
  }
}

declare module 'react-syntax-highlighter/dist/cjs/styles/prism' {
  export const atomDark: any;
  export const prism: any;
  export const dark: any;
  export const okaidia: any;
  export const solarizedlight: any;
  export const tomorrow: any;
  export const twilight: any;
  export const coy: any;
  export const duotoneLight: any;
  export const duotoneDark: any;
  export const duotoneEarth: any;
  export const duotoneForest: any;
  export const duotoneSea: any;
  export const duotoneSpace: any;
  export const github: any;
  export const darcula: any;
  export const vscDarkPlus: any;
} 