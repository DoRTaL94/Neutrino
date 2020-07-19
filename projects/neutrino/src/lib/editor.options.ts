export interface EditorOptions {
    tabSpaces?: number;
}

export class DefaultEditorOptions implements EditorOptions {
    tabSpaces = 2;
}
