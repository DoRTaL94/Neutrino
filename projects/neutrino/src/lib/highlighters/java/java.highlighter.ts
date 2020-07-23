import { Renderer2 } from '@angular/core';
import { Highlighter } from '../highlighter';
import { KeywordType } from '../keyword.type';
import { keywords } from './keywords';

export class JavaHighlighter implements Highlighter {
  private renderer: Renderer2;
  private codeLength: number;
  private code: string;
  private line: HTMLDivElement;
  private isMultiCommentOpened: boolean;
  private isQuoteOpened: boolean;

  constructor(renderer: Renderer2) {
    this.renderer = renderer;
  }

  public highlightLine(line: HTMLDivElement): void {
    if (line.firstChild.nodeName.toLowerCase() !== 'br') {
      this.code = line.textContent;
      this.line = line;
      this.codeLength = this.code.length;
      const builder = [];
      this.line.innerHTML = '';
      this.highlightHelper(0, builder);
    }
  }

  private highlightHelper(currentIndex: number, builder: any[]) {
    if (this.isQuote(currentIndex)) {
      this.handleQuote(currentIndex, builder);
    } else if (this.isOneLineComment(currentIndex)) {
      this.handleOneLineComment(currentIndex, builder);
    } else if (this.isMultiLineComment(currentIndex)) {
      this.handleMultiLineComment(currentIndex, builder);
    } else if (this.isAnnotation(currentIndex)) {
      this.handleAnnotation(currentIndex, builder);
    } else if (currentIndex < this.codeLength) {
      this.checkForKeywords(currentIndex, builder);
    }
  }

  private checkForKeywords(currentIndex: number, builder: any[]): void {
    const currentChar = this.code.charAt(currentIndex);

    if (currentChar === ' ' || currentIndex + 1 === this.codeLength) {
      if (currentChar !== ' ' && currentIndex + 1 === this.codeLength) {
        builder.push(currentChar);
      }

      const currentWord = builder.join('');

      if (keywords.get(currentWord)) {
        this.appendText(currentWord, keywords.get(currentWord));
      } else if (builder.length > 0) {
        let builderWithoutStructuralKeywords = [];

        for (const char of builder) {
          if (keywords.get(char) === KeywordType.Structural) {
            const wordWithoutStructuralKeyword = builderWithoutStructuralKeywords.join('');

            if (wordWithoutStructuralKeyword !== '') {
              if (keywords.get(wordWithoutStructuralKeyword)) {
                this.appendText(wordWithoutStructuralKeyword, keywords.get(wordWithoutStructuralKeyword));
              } else {
                this.appendText(wordWithoutStructuralKeyword);
              }
            }

            this.appendText(char, keywords.get(char));
            builderWithoutStructuralKeywords = [];
          } else {
            builderWithoutStructuralKeywords.push(char);
          }
        }

        if (builderWithoutStructuralKeywords.length > 0) {
          this.appendText(builderWithoutStructuralKeywords.join(''));
        }
      }

      if (currentChar === ' ') {
        builder = [];
        this.addSpace();
      }
    } else {
      builder.push(currentChar);
    }

    this.highlightHelper(currentIndex + 1, builder);
  }

  private handleQuote(currentIndex: number, builder: any[]): void {
    const quoteLength = 1;

    if (builder.length > 0) {
      this.appendText(builder.join(''));
      builder = [];
    }

    let endOfQuote = this.getEndIndexOfQuote(this.isQuoteOpened ? currentIndex : currentIndex + quoteLength);
    endOfQuote = endOfQuote === -1 ? this.codeLength : endOfQuote;
    this.appendSubstring(currentIndex, endOfQuote, 'string-literal');

    if (endOfQuote !== this.codeLength) {
      this.highlightHelper(endOfQuote, builder);
    }
  }

  private getEndIndexOfQuote(currentIndex: number) {
    let endIndex = -1;
    this.isQuoteOpened = true;

    while (
      currentIndex < this.codeLength &&
      !(this.code.charAt(currentIndex) === '"' || this.code.charAt(currentIndex) === '\'')
    ) {
      currentIndex++;
      endIndex = currentIndex;
    }

    if (
      currentIndex < this.codeLength &&
      (this.code.charAt(currentIndex) === '"' || this.code.charAt(currentIndex) === '\'')
    ) {
      endIndex = currentIndex;
      this.isQuoteOpened = false;
    }

    return endIndex === -1 ? -1 : endIndex + 1;
  }

  private handleAnnotation(currentIndex: number, builder: any[]): void {
    let endIndexOfAnnotation = this.getEndIndexOfAnnotation(currentIndex + 1);
    endIndexOfAnnotation = endIndexOfAnnotation === -1 ? this.codeLength : endIndexOfAnnotation;
    this.appendSubstring(currentIndex, endIndexOfAnnotation, 'annotation');

    if (endIndexOfAnnotation !== this.codeLength) {
      this.highlightHelper(endIndexOfAnnotation, builder);
    }
  }

  private handleOneLineComment(currentIndex: number, builder: any[]): void {
    if (builder.length > 0) {
      this.appendText(builder.join(''));
    }

    this.appendSubstring(currentIndex, this.codeLength, 'comment');
  }

  private handleMultiLineComment(currentIndex: number, builder: any[]): void {
    let endOfMultiLineComment = this.getEndOfMultiLineComment(
      this.isMultiCommentOpened ? currentIndex : currentIndex + 2,
    );
    endOfMultiLineComment = endOfMultiLineComment === -1 ? this.codeLength : endOfMultiLineComment;
    this.appendSubstring(currentIndex, endOfMultiLineComment, 'comment');

    if (endOfMultiLineComment !== this.codeLength) {
      this.highlightHelper(endOfMultiLineComment, builder);
    }
  }

  private isQuote(index: number) {
    return (
      this.isQuoteOpened ||
      (index < this.codeLength && (this.code.charAt(index) === '"' || this.code.charAt(index) === '\''))
    );
  }

  private isOneLineComment(index: number): boolean {
    return index < this.codeLength - 1 && this.code.charAt(index) === '/' && this.code.charAt(index + 1) === '/';
  }

  private isMultiLineComment(index: number): boolean {
    return (
      this.isMultiCommentOpened ||
      (index < this.codeLength - 1 && this.code.charAt(index) === '/' && this.code.charAt(index + 1) === '*')
    );
  }

  private isAnnotation(index: number): boolean {
    return index < this.codeLength && this.code.charAt(index) === '@';
  }

  private appendText(text: string, styleClass?: string): void {
    const textElem = this.renderer.createText(text);
    let span;

    if (styleClass) {
      span = this.renderer.createElement('span');
      this.renderer.appendChild(span, textElem);
      this.renderer.addClass(span, styleClass);
      this.renderer.appendChild(this.line, span);
    } else {
      this.renderer.appendChild(this.line, textElem);
    }
  }

  private addSpace(): void {
    const space = this.renderer.createText(' ');
    const span = this.renderer.createElement('span');
    this.renderer.appendChild(span, space);
    this.renderer.appendChild(this.line, span);
  }

  private getEndOfMultiLineComment(currentIndex: number): number {
    let endIndex = -1;
    this.isMultiCommentOpened = true;

    while (
      currentIndex < this.codeLength - 1 &&
      !(this.code.charAt(currentIndex) === '*' && this.code.charAt(currentIndex + 1) === '/')
    ) {
      currentIndex++;
      endIndex = currentIndex;
    }

    if (this.code.charAt(currentIndex) === '*' && this.code.charAt(currentIndex + 1) === '/') {
      endIndex = currentIndex;
      this.isMultiCommentOpened = false;
    }

    return endIndex === -1 ? -1 : endIndex + 2;
  }

  private getEndIndexOfAnnotation(currentIndex: number): number {
    let endIndex = -1;

    while (currentIndex < this.codeLength && /[a-zA-Z]/.test(this.code.charAt(currentIndex))) {
      currentIndex++;
      endIndex = currentIndex;
    }

    return endIndex;
  }

  private appendSubstring(start: number, end: number, styleClass?: string): void {
    const text = this.createTextElement(
      this.code.substring(start, end),
      styleClass !== null || styleClass !== 'undefined',
    );

    if (styleClass) {
      this.renderer.addClass(text, styleClass);
    }

    this.renderer.appendChild(this.line, text);
  }

  private createTextElement(text: string, surroundWithSpan?: boolean): HTMLElement {
    const textElem = this.renderer.createText(text);
    let result = textElem;

    if (surroundWithSpan) {
      result = this.renderer.createElement('span');
      this.renderer.appendChild(result, textElem);
    }

    return result;
  }
}
