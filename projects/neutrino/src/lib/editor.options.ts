export interface EditorOptions {
    tabSpaces?: number;
    lineHeight?: string;
    fontSize?: string;
}

export class DefaultEditorOptions implements EditorOptions {
    tabSpaces = 2;
    lineHeight = `${1.2 * 1.3}rem`;
    fontSize = '1.2rem';
}
