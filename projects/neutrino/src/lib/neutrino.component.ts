import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import { Subscription } from 'rxjs';
import { EditorState } from './editor-state';
import { Highlighter } from './highlighters/highlighter';
import { HightlightsService } from './highlighters/highlights.service';
import { EventType, NeutrinoService } from './neutrino.service';


/**
 * This class is a component that controls Neutrino view.
 */
@Component({
  selector: 'nt-editor',
  templateUrl: './neutrino.component.html',
  styleUrls: ['./neutrino.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class NeutrinoComponent implements OnDestroy, OnInit, AfterViewInit, OnChanges {
  @ViewChild('editor')
  editor: ElementRef;
  @ViewChild('numbers')
  numbers: ElementRef;

  @Input()
  public initialValue = '';
  @Input()
  public fontSize = '1.2rem';
  @Input()
  public tabSpaces = '2';
  @Input()
  public showLineNumber: boolean;
  @Input()
  public value: string;
  @Input()
  public codeType;
  @Input()
  public editable: boolean;
  @Output()
  public valueChanged = new EventEmitter<string>();

  public lineHeight = `${1.2 * 1.3}rem`;
  public lines = [1];
  public currentLine = -1;
  private valueChangedSub: Subscription;
  private hightlighter: Highlighter;
  private clipboard: string;
  private tabSpacesParsed: number;

  constructor(
    private neutrinoService: NeutrinoService,
    private renderer: Renderer2,
    private highlightsService: HightlightsService
  ) { }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.codeType) {
      this.hightlighter = this.highlightsService
        .getByCodeType(this.editor, this.codeType.toLowerCase(), this.renderer);
    }

    if (changes.initialValue) {
      this.refreshEditorValue(this.initialValue, true);
    }

    if (changes.value) {
      this.onValueChanged(changes);
    }

    if (changes.fontSize) {
      this.onFontSizeChanged();
    }

    if (changes.tabSpaces) {
      this.onTabSpacesChanged();
    }
  }

  public ngOnInit(): void {
    if (this.codeType) {
      this.hightlighter = this.highlightsService
      .getByCodeType(this.editor, this.codeType.toLowerCase(), this.renderer);
    }

    this.showLineNumber = this.showLineNumber !== undefined;
    this.editable = this.editable !== undefined;

    // refresh lines numbers based on the initial value inside 'value' property.
    if (this.value && this.value !== '') {
      let num = 2;
      this.lines = [1];

      Array.from(this.value).forEach(char => {
        if (char === '\n') {
          this.lines.push(num++);
        }
      });
    }

    this.refreshFontSizeAndLineHeight();
  }

  public ngOnDestroy(): void {
    if (this.valueChangedSub) {
      this.valueChangedSub.unsubscribe();
    }
  }

  /**
   * This is the place to add configurations and controls for the editor view.
   */
  public ngAfterViewInit(): void {
    this.tabSpacesParsed = isNaN(Number(this.tabSpaces)) || Number(this.tabSpaces) <= 0 ? 2 : Number(this.tabSpaces);
    this.neutrinoService.setEditorOptions(this.editor, {
      tabSpaces: this.tabSpacesParsed,
      lineHeight: this.lineHeight,
      fontSize: this.fontSize
    });

    if (this.editable) {
      this.valueChangedSub = this.neutrinoService
      .getValueChangedListener(this.editor)
      .subscribe(value => {
        this.valueChanged.emit(value);
      });

      this.neutrinoService.addEventHandler(this.editor, EventType.Paste,     this.handlePaste.bind(this)                    );
      this.neutrinoService.addEventHandler(this.editor, EventType.Copy,      this.saveToClipboard.bind(this)                );
      this.neutrinoService.addEventHandler(this.editor, EventType.Cut,       this.saveToClipboard.bind(this)                );
      this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown,   this.handleCopy.bind(this)                     );
      this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown,   this.handleCut.bind(this)                      );
      this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown,   this.handleDeletion.bind(this)                 );
      this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown,   this.handleInsertTab.bind(this)                );
      this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown,   this.handleAutoComplete.bind(this)             );
      this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown,   this.addNewLineOnEnter.bind(this)              );
      this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown,   this.hightlightCode.bind(this),            true);
      this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown,   this.scrollFocusedLineIntoView.bind(this), true);
      this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown,   this.focusLine.bind(this),                 true);
      this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown,   this.refreshLines.bind(this),              true);
      this.neutrinoService.addEventHandler(this.editor, EventType.Input,     this.refreshLines.bind(this),              true);
      this.neutrinoService.addEventHandler(this.editor, EventType.Input,     this.hightlightCode.bind(this),            true);
      this.neutrinoService.addEventHandler(this.editor, EventType.MouseDown, this.focusLine.bind(this),                 true);
    } else {
      this.renderer.setAttribute(this.editor.nativeElement, 'contenteditable', 'false');
    }

    if (this.value === '') {
      this.refreshEditorValue(this.initialValue);
    } else {
      this.refreshEditorValue(this.value);
    }
  }

  /**
   * Handles any editor's event by calling {@link NeutrinoService.handleEvent}.
   * This method is bound to the editor's events described in the template.
   */
  public handleEvent(event: Event): void {
    this.neutrinoService.handleEvent(this.editor, event);
  }

  /**
   * @internal
   */
  private refreshFontSizeAndLineHeight(): void {
    let numberLength = 0;

    Array.from(this.fontSize).forEach(char => {
      if (!isNaN(Number(char)) || char === '.') {
        numberLength++;
      }
    });

    if (numberLength > 0 && numberLength < this.fontSize.length) {
      const fontSize = this.fontSize.substring(0, numberLength);
      this.fontSize = `${Math.max(Number(fontSize), 1)}rem`;
      const lineHeightNumber = Math.max(Number(fontSize), 1) * 1.3;
      this.lineHeight = `${lineHeightNumber}${this.fontSize.substring(numberLength)}`;
    }
  }

  private onValueChanged(changes: SimpleChanges): void {
    if (this.editor && (changes.value.currentValue === null || changes.value.currentValue === '')) {
      (this.editor.nativeElement as HTMLElement).innerHTML =
        `<div style="line-height: ${this.lineHeight}; font-size: ${this.fontSize}" class="view-line focus"><br></div>`;
    } else {
      this.refreshEditorValue(this.value, true);
    }
  }

  private onTabSpacesChanged(): void {
    const editorOptions = this.neutrinoService.getEditorOptions(this.editor);

    if (editorOptions) {
      this.tabSpacesParsed = isNaN(Number(this.tabSpaces)) || Number(this.tabSpaces) <= 0 ? 2 : Number(this.tabSpaces);
      editorOptions.tabSpaces = this.tabSpacesParsed;
      this.refreshEditorValue(this.value, true, true);
    }
  }

  private onFontSizeChanged(): void {
    const editorOptions = this.neutrinoService.getEditorOptions(this.editor);

    if (editorOptions) {
      this.refreshFontSizeAndLineHeight();
      editorOptions.fontSize = this.fontSize;
      editorOptions.lineHeight = this.lineHeight;
      this.refreshEditorValue(this.value, true, true);
    }
  }

  /**
   * @internal
   */
  private refreshEditorValue(text: string, refreshLines?: boolean, forceRefresh?: boolean) {
    if ((this.editor && this.neutrinoService.getEditorText(this.editor) !== text) || forceRefresh) {
      this.neutrinoService.render(this.editor, text);
      this.hightlightCode();

      if (refreshLines) {
        this.refreshLines();
      }
    }
  }

  /**
   * @internal
   */
  private handleCopy(event: KeyboardEvent): void {
    if (event.key === 'c' && event.ctrlKey) {
      this.saveToClipboard();
      event.preventDefault();
    }
  }

  /**
   * @internal
   */
  private saveToClipboard(): void {
    this.clipboard = document.getSelection().toString();
  }

  /**
   * @internal
   */
  private handlePaste(event: Event): void {
    if (this.clipboard) {
      const state = this.neutrinoService.getEditorState(this.editor);
      const lines = this.neutrinoService.getEditorText(this.editor).split('\n');
      lines[state.currentLine] = `${
        lines[state.currentLine]
        .substring(0, state.anchorIndex)}${this.clipboard}${lines[state.currentLine].substring(state.focusIndex)
      }`;
      this.neutrinoService.render(this.editor, lines.join('\n'));
      const clipboardLines = this.clipboard.split('\n');
      const clipboardLinesLength = clipboardLines.length - 1;

      if (clipboardLinesLength > 0) {
        state.currentLine += clipboardLinesLength;
        state.focusIndex = clipboardLines[clipboardLinesLength].length;
        state.anchorIndex = state.focusIndex;
      } else {
        const clipboardLength =
          this.clipboard[clipboardLinesLength] === '\n' ? clipboardLinesLength : this.clipboard.length;
        state.focusIndex = state.anchorIndex + clipboardLength;
        state.anchorIndex = state.focusIndex;
      }

      this.neutrinoService.restoreSelection(this.editor);
      this.refreshLines();
      this.hightlightCode(event instanceof KeyboardEvent ? event as KeyboardEvent : null);
    }

    event.preventDefault();
  }

  /**
   * @internal
   *
   * Allows single line deletion when pressing ctrl + 'x' and there is no text selected,
   * and deletion of the last line (the default browser cut not deleting the last line but only its content).
   */
  private handleCut(event?: KeyboardEvent) {
    if (event.ctrlKey && event.key === 'x') {
      const sel: Selection = document.getSelection();
      const anchorLine = this.neutrinoService.getParentLine(this.editor, sel.anchorNode as HTMLElement);
      const focusLine = this.neutrinoService.getParentLine(this.editor, sel.focusNode  as HTMLElement);
      const lines: NodeList = this.editor.nativeElement.querySelectorAll('.view-line');
      const lastChildAndNotTheOnlyLine = lines.length > 1 && this.editor.nativeElement.lastChild.isSameNode(anchorLine);
      const range = new Range();

      // Allows last line deletion.
      if (lastChildAndNotTheOnlyLine) {
        const lineToSetFocus = anchorLine.previousSibling;

        if (lineToSetFocus) {
          range.setStart(lineToSetFocus, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }

        anchorLine.remove();
      }
      // Allows single line deletion.
      else if (
        lines.length > 1 &&
        anchorLine.isSameNode(focusLine) &&
        sel.anchorOffset === sel.focusOffset
      ) {
        range.setStartBefore(anchorLine);
        range.setEndAfter(anchorLine);
        sel.removeAllRanges();
        sel.addRange(range);
      }

      if (!lastChildAndNotTheOnlyLine) {
        document.execCommand('cut');
        event.preventDefault();
      }
    }
  }

  /**
   * @internal
   *
   * Adds focus class name to a line classes list.
   * Removes the focus class name for the other lines in the editor if presented.
   *
   * @param editor The parent editor reference of the "line" input.
   * @param line A line element to focus.
   */
  private focusLine(event?: KeyboardEvent | MouseEvent) {
    const lines: NodeList = this.editor.nativeElement.querySelectorAll('.view-line');
    const state: EditorState = this.neutrinoService.getEditorState(this.editor);
    let currentLineSet = false;
    let focusedLine;
    state.currentLine = 0;
    let currentLine;

    if (event instanceof MouseEvent) {
      currentLine = this.neutrinoService.getParentLine(this.editor, event.target as HTMLElement);
    } else if (event instanceof KeyboardEvent) {
      currentLine = this.neutrinoService.getClosestViewLine(this.editor);
    }

    if (event instanceof KeyboardEvent) {
      if (currentLine.previousSibling &&
        (event.key === 'ArrowUp' || (state.focusIndex === 0 && event.key === 'ArrowLeft'))
      ) {
        focusedLine = currentLine.previousSibling;
        state.anchorIndex = state.focusIndex = focusedLine.textContent.length;
      } else if (currentLine.nextSibling &&
        (event.key === 'ArrowDown' || (state.focusIndex === currentLine.textContent.length && event.key === 'ArrowRight'))
      ) {
        focusedLine = currentLine.nextSibling;
        state.anchorIndex = state.focusIndex = 0;
      } else if (event.ctrlKey && event.key === 'Home') {
        focusedLine = this.editor.nativeElement.firstChild;
      } else if (event.ctrlKey && event.key === 'End') {
        focusedLine = this.editor.nativeElement.lastChild;
      } else {
        if (event.key === 'Enter') {
          state.focusIndex = 0;
          state.anchorIndex = 0;
        }

        focusedLine = currentLine;
      }
    } else if (event instanceof MouseEvent) {
      focusedLine = this.neutrinoService.getParentLine(this.editor, event.target as HTMLElement);
    }

    lines.forEach((currLine) => {
      if (currLine.isSameNode(focusedLine)) {
        currentLineSet = true;
        this.renderer.addClass(currLine, 'focus');
      } else {
        this.renderer.removeClass(currLine, 'focus');
      }

      if (!currentLineSet) {
        state.currentLine++;
      }
    });

    this.currentLine = state.currentLine;
  }

  private scrollFocusedLineIntoView(): void {
    const line: HTMLDivElement = this.neutrinoService.getClosestViewLine(this.editor);
    line.scrollIntoView(false);
  }

  private hightlightCode(event?: KeyboardEvent): void {
    if (this.hightlighter) {
      const lines: NodeList = this.editor.nativeElement.querySelectorAll('.view-line');
      lines.forEach(line => this.hightlighter.highlightLine(line as HTMLDivElement));

      if (event) {
        this.neutrinoService.restoreSelection(this.editor);
      }
    }
  }

  /**
   * Refreshes {@link NeutrinoComponent.lines} array.
   * Called whenever there's a change in the editor.
   */
  private refreshLines(): void {
    let num = 1;

    this.lines = [];
    Array.from(
      this.editor.nativeElement
      .querySelectorAll('.view-line')
    )
    .forEach(() => this.lines.push(num++));
  }

  /**
   * Handles auto completion of certain keywords once inserted.
   */
  private handleAutoComplete(event?: Event): void {
    let opening: Text;
    let closure: Text;

    if (event instanceof KeyboardEvent) {
      if (event.key === '{') {
        opening = this.renderer.createText('{');
        closure = this.renderer.createText('}');
      } else if (event.key === '[') {
        opening = this.renderer.createText('[');
        closure = this.renderer.createText(']');
      } else if (event.key === '(') {
        opening = this.renderer.createText('(');
        closure = this.renderer.createText(')');
      }
    }

    if (opening) {
      const sel = document.getSelection();
      const range = sel.getRangeAt(0);

      range.insertNode(closure);
      range.insertNode(opening);
      range.setStartBefore(closure);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      event.preventDefault();
    }
  }

  /**
   * Handles click event of the "Backspace" button.
   * Prevents line deletion if it's the last one.
   */
  private handleDeletion(event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      const line = this.neutrinoService.getClosestViewLine(this.editor);
      const emptyLine = line?.textContent === '';
      const oneLine = this.editor.nativeElement.querySelectorAll('.view-line').length === 1;

      if (!emptyLine || !oneLine) {
        document.execCommand('delete');
      }

      event.preventDefault();
    }
  }

  /**
   * Handles click event of the "Tab" button and insert a number of
   * non-breaking spaces defined in {@link NeutrinoComponent.tabSpaces}.
   *
   * Note: by default contenteditable DOM element doesn't allow tab insertion.
   */
  private handleInsertTab(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      const sel = document.getSelection();
      const range = sel.getRangeAt(0);
      const anchorLine: HTMLDivElement = this.neutrinoService
        .getParentLine(this.editor, sel.anchorNode as HTMLElement);
      const focusLine: HTMLDivElement = this.neutrinoService
        .getParentLine(this.editor, sel.focusNode as HTMLElement);

      // In case user selected text and pressed 'Tab', the text should be deleted and be replaced with a tab
      range.extractContents();

      // Multiline selection
      if (!anchorLine.isSameNode(focusLine)) {
        // extractContents function doesn't remove anchor line if it's empty after extraction
        if (anchorLine.textContent === '') {
          anchorLine.remove();
        }

        range.setStartAfter(focusLine.lastChild);
        range.collapse(true);
      }

      for (let i = 0 ; i < this.tabSpacesParsed; i++) {
        const nonBreakingSpace = this.renderer.createText('\u00a0');
        range.insertNode(nonBreakingSpace);
        range.setStartAfter(nonBreakingSpace);
        range.collapse(true);
      }

      sel.removeAllRanges();
      sel.addRange(range);

      event.preventDefault();
    }
  }

  /**
   * Adds a new line on "Enter" clicked and prevents default new line insertion of contenteditable attribute.
   * The new line content gets aligned, thus, tabs are inserted to the start of the new line to fit the previous line tabs count.
   */
  private addNewLineOnEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      const sel: Selection = document.getSelection();
      const range: Range = sel.getRangeAt(0);
      let currentLine: HTMLDivElement = this.neutrinoService.getClosestViewLine(this.editor);

      if (!currentLine) {
        currentLine = this.editor.nativeElement.firstChild;
      }

      range.setEndAfter(currentLine.lastChild);
      const content = range.extractContents();
      range.collapse(false);
      const textContent = content.textContent;
      const closureIndex = this.findFirstIndexOfClosureAfterOpening(currentLine.textContent, textContent);
      let newLine: HTMLDivElement;

      if (closureIndex !== -1) {
        const insideContent = textContent.substring(0, closureIndex);
        const afterContent = textContent.substring(closureIndex);
        const lineWithClosure = this.neutrinoService.addNewLine(this.editor, true, afterContent, currentLine);
        this.neutrinoService.keepTextAligned(this.editor, lineWithClosure);
        newLine = this.neutrinoService.addNewLine(this.editor, true, insideContent, currentLine);
      } else {
        newLine = this.neutrinoService.addNewLine(this.editor, true, textContent, currentLine);
      }

      this.neutrinoService.keepTextAligned(this.editor, newLine);
      event.preventDefault();
    }
  }

  /**
   * @internal
   *
   * Finds the first index of '}' in "currentLineText" input (if exists),
   * but only if there is a '{' in "previousLineText".
   * If the conditions above are not met this function return -1.
   */
  private findFirstIndexOfClosureAfterOpening(previousLineText: string, currentLineText: string): number {
    let i = -1;

    if (previousLineText.lastIndexOf('{') !== -1) {
      for (i = 0; i < currentLineText.length; i++) {
        if (currentLineText[i] === '}') {
          break;
        }
      }
    }

    if (i === currentLineText.length) {
      i = -1;
    }

    return i;
  }
}
