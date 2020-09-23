import { ElementRef, Injectable, Renderer2 } from '@angular/core';
import { CodeType } from './code.type';
import { Highlighter } from './highlighter';
import { javaKeywords } from './java/java-keywords';
import { JavaHighlighter } from './java/java.highlighter';
import { jsKeywords } from './javascript/js-keywords';

@Injectable({
  providedIn: 'root'
})
export class HightlightsService {
  private highlighters: Map<ElementRef, Highlighter> = new Map<ElementRef, Highlighter>();

  public getByCodeType(editor: ElementRef, codeType: CodeType, renderer: Renderer2) {
    switch (codeType) {
      case CodeType.Java:
        if (
          !this.highlighters.has(editor) ||
          !(this.highlighters.get(editor) instanceof JavaHighlighter)
        ) {
          this.highlighters.set(editor, new JavaHighlighter(renderer, javaKeywords));
        }
        break;
      case CodeType.Javascript:
        if (
          !this.highlighters.has(editor) ||
          !(this.highlighters.get(editor) instanceof Highlighter)
        ) {
          this.highlighters.set(editor, new Highlighter(renderer, jsKeywords));
        }
        break;
    }

    return this.highlighters.get(editor);
  }
}
