import { ElementRef, Injectable, Renderer2 } from '@angular/core';
import { CodeType } from './code.type';
import { Highlighter } from './highlighter';
import { JavaHighlighter } from './java/java.highlighter';

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
          this.highlighters.set(editor, new JavaHighlighter(renderer));
        }
        break;
    }

    return this.highlighters.get(editor);
  }
}
