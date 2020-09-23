import { Renderer2 } from '@angular/core';
import { KeywordType } from 'dist/neutrino/lib/highlighters/keyword.type';
import { Highlighter } from '../highlighter';

export class JavaHighlighter extends Highlighter {
  constructor(renderer: Renderer2, keywords: Map<string, KeywordType>) {
    super(renderer, keywords);
    this.charHandlers = [
      {
        checkCurrentChar: (currentIndex, currentBuffer) => this.isAnnotation(currentIndex),
        handleCurrentChar: (currentIndex, currentBuffer) => this.handleAnnotation(currentIndex, currentBuffer)
      }
    ];
  }

  private handleAnnotation(currentIndex: number, buffer: any[]): void {
    let endIndexOfAnnotation = this.getEndIndexOfAnnotation(currentIndex + 1);
    endIndexOfAnnotation = endIndexOfAnnotation === -1 ? this.codeLength : endIndexOfAnnotation;
    this.appendSubstring(currentIndex, endIndexOfAnnotation, 'annotation');

    if (endIndexOfAnnotation !== this.codeLength) {
      this.highlightHelper(endIndexOfAnnotation, buffer);
    }
  }

  private getEndIndexOfAnnotation(currentIndex: number): number {
    let endIndex = -1;

    while (currentIndex < this.codeLength && /[a-zA-Z]/.test(this.code.charAt(currentIndex))) {
      currentIndex++;
      endIndex = currentIndex;
    }

    return endIndex;
  }

  private isAnnotation(index: number): boolean {
    return index < this.codeLength && this.code.charAt(index) === '@';
  }
}
