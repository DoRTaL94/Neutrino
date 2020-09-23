import { Renderer2 } from '@angular/core';
import { KeywordType } from './keyword.type';
import { ICharHandler } from './char-handler';

export class Highlighter {
  protected renderer: Renderer2;
  protected codeLength: number;
  protected code: string;
  protected line: HTMLDivElement;
  protected isMultiCommentOpened: boolean;
  protected isQuoteOpened: boolean;
  protected charHandlers: ICharHandler[];
  protected keywords: Map<string, KeywordType>;

  constructor(renderer: Renderer2, keywords: Map<string, KeywordType>) {
    this.keywords = keywords;
    this.renderer = renderer;
  }

  public highlightLine(line: HTMLDivElement): void {
    this.isQuoteOpened = false;

    // If line is not empty
    if (line.firstChild && line.firstChild.nodeName.toLowerCase() !== 'br') {
      this.code = line.textContent;
      this.line = line;
      this.codeLength = this.code.length;
      const builder = [];
      this.line.innerHTML = '';
      this.highlightHelper(0, builder);
    }
  }

  protected highlightHelper(currentIndex: number, builder: any[]) {
    if (this.isQuote(currentIndex)) {
      this.handleQuote(currentIndex, builder);
    } else if (this.isOneLineComment(currentIndex)) {
      this.handleOneLineComment(currentIndex, builder);
    } else if (this.isMultiLineComment(currentIndex)) {
      this.handleMultiLineComment(currentIndex, builder);
    } else if (!this.checkCases(currentIndex, builder) && currentIndex < this.codeLength) {
      this.checkForKeywords(currentIndex, builder);
    }
  }

  private checkCases(currentIndex: number, builder: any[]): boolean {
    let handlerExecuted = false;

    if (this.charHandlers) {
      for (const handler of this.charHandlers) {
        if (handler.checkCurrentChar(currentIndex, builder)) {
          handler.handleCurrentChar(currentIndex, builder);
          handlerExecuted = true;
          break;
        }
      }
    }

    return handlerExecuted;
  }

  protected checkForKeywords(currentIndex: number, builder: any[]): void {
    const currentChar = this.code.charAt(currentIndex);

    if (
      currentChar === ' ' ||
      currentChar === '\u00a0' ||
      currentIndex + 1 === this.codeLength
    ) {
      if (
        currentChar !== ' ' &&
        currentChar !== '\u00a0' &&
        currentIndex + 1 === this.codeLength
      ) {
        builder.push(currentChar);
      }

      const currentWord = builder.join('');

      if (this.keywords.get(currentWord)) {
        this.appendText(currentWord, this.keywords.get(currentWord));
      } else if (builder.length > 0) {
        let builderWithoutStructuralKeywords = [];

        for (const char of builder) {
          if (this.keywords.get(char) === KeywordType.Structural) {
            const wordWithoutStructuralKeyword = builderWithoutStructuralKeywords.join('');

            if (wordWithoutStructuralKeyword !== '') {
              if (this.keywords.get(wordWithoutStructuralKeyword)) {
                this.appendText(wordWithoutStructuralKeyword, this.keywords.get(wordWithoutStructuralKeyword));
              } else {
                this.appendText(wordWithoutStructuralKeyword);
              }
            }

            this.appendText(char, this.keywords.get(char));
            builderWithoutStructuralKeywords = [];
          } else {
            builderWithoutStructuralKeywords.push(char);
          }
        }

        if (builderWithoutStructuralKeywords.length > 0) {
          const word = builderWithoutStructuralKeywords.join('');
          this.appendText(word, this.keywords.get(word));
        }
      }

      if (currentChar === ' ' || currentChar === '\u00a0') {
        builder = [];
        this.addSpace(currentChar === '\u00a0');
      }
    } else {
      builder.push(currentChar);
    }

    this.highlightHelper(currentIndex + 1, builder);
  }

  protected handleQuote(currentIndex: number, builder: any[]): void {
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

  protected getEndIndexOfQuote(currentIndex: number) {
    let endIndex = -1;
    this.isQuoteOpened = true;

    while (
      currentIndex < this.codeLength &&
      this.keywords.get(this.code.charAt(currentIndex)) !== KeywordType.StrQuote
    ) {
      currentIndex++;
      endIndex = currentIndex;
    }

    if (
      currentIndex < this.codeLength &&
      this.keywords.get(this.code.charAt(currentIndex)) === KeywordType.StrQuote
    ) {
      endIndex = currentIndex;
      this.isQuoteOpened = false;
    }

    return endIndex === -1 ? -1 : endIndex + 1;
  }

  protected handleOneLineComment(currentIndex: number, builder: any[]): void {
    if (builder.length > 0) {
      this.appendText(builder.join(''));
    }

    this.appendSubstring(currentIndex, this.codeLength, 'comment');
  }

  protected handleMultiLineComment(currentIndex: number, builder: any[]): void {
    let endOfMultiLineComment = this.getEndOfMultiLineComment(
      this.isMultiCommentOpened ? currentIndex : currentIndex + 2,
    );
    endOfMultiLineComment = endOfMultiLineComment === -1 ? this.codeLength : endOfMultiLineComment;
    this.appendSubstring(currentIndex, endOfMultiLineComment, 'comment');

    if (endOfMultiLineComment !== this.codeLength) {
      this.highlightHelper(endOfMultiLineComment, builder);
    }
  }

  protected isQuote(index: number) {
    return this.isQuoteOpened || this.keywords.get(this.code.charAt(index)) === KeywordType.StrQuote;
  }

  protected isOneLineComment(index: number): boolean {
    return index < this.codeLength - 1 && this.code.charAt(index) === '/' && this.code.charAt(index + 1) === '/';
  }

  protected isMultiLineComment(index: number): boolean {
    return (
      this.isMultiCommentOpened ||
      (index < this.codeLength - 1 && this.code.charAt(index) === '/' && this.code.charAt(index + 1) === '*')
    );
  }

  protected appendText(text: string, styleClass?: string): void {
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

  protected addSpace(nonBreaking?: boolean): void {
    const space = this.renderer.createText(nonBreaking ? '\u00a0' : ' ');

    if (!nonBreaking) {
      const span = this.renderer.createElement('span');
      this.renderer.appendChild(span, space);
      this.renderer.appendChild(this.line, span);
    } else {
      this.renderer.appendChild(this.line, space);
    }
  }

  protected getEndOfMultiLineComment(currentIndex: number): number {
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

  protected appendSubstring(start: number, end: number, styleClass?: string): void {
    const text = this.createTextElement(
      this.code.substring(start, end),
      styleClass !== null || styleClass !== 'undefined',
    );

    if (styleClass) {
      this.renderer.addClass(text, styleClass);
    }

    this.renderer.appendChild(this.line, text);
  }

  protected createTextElement(text: string, surroundWithSpan?: boolean): HTMLElement {
    const textElem = this.renderer.createText(text);
    let result = textElem;

    if (surroundWithSpan) {
      result = this.renderer.createElement('span');
      this.renderer.appendChild(result, textElem);
    }

    return result;
  }
}
