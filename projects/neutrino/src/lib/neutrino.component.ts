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

  @Input()
  public tabSpaces = 2;
  @Input()
  public showLineNumber: boolean;
  @Input()
  public value: string;
  @Input()
  public codeType;
  @Output()
  public valueChanged = new EventEmitter<string>();

  public lines = [1];
  private valueChangedSub: Subscription;
  private hightlighter: Highlighter;

  constructor(
    private neutrinoService: NeutrinoService,
    private renderer: Renderer2,
    private highlightsService: HightlightsService
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes.value &&
      this.editor &&
      this.neutrinoService.getEditorText(this.editor) !== this.value
    ) {
      this.neutrinoService.render(this.editor, this.value);
      this.refreshLines();
    }
  }

  ngOnInit(): void {
    if (this.codeType) {
      this.hightlighter = this.highlightsService.getByCodeType(this.editor, this.codeType.toLowerCase(), this.renderer);
    }
    this.showLineNumber = this.showLineNumber !== undefined;
  }

  ngOnDestroy(): void {
    this.valueChangedSub.unsubscribe();
  }

  /**
   * Adds configurations and controls for the editor view.
   */
  ngAfterViewInit(): void {
    this.valueChangedSub = this.neutrinoService
    .getValueChangedListener(this.editor)
    .subscribe(value => this.valueChanged.emit(value));

    this.neutrinoService.setEditorOptions(this.editor, {
      tabSpaces: this.tabSpaces
    });

    this.neutrinoService.addEventHandler(this.editor, EventType.Input, this.refreshLines.bind(this), true);
    this.neutrinoService.addEventHandler(this.editor, EventType.Input, this.hightlightCode.bind(this), true);
    this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown, this.hightlightCode.bind(this), true);
    this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown, this.handleDeletion.bind(this));
    this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown, this.handleInsertTab.bind(this));
    this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown, this.handleAutoComplete.bind(this));
    this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown, this.addNewLineOnEnter.bind(this));
  }

  /**
   * Handles any editor's event by calling {@link NeutrinoService.handleEvent}.
   * This method is bound to the editor's events described in the template.
   */
  public handleEvent(event: Event): void {
    this.neutrinoService.handleEvent(this.editor, event);
  }

  private hightlightCode(event: KeyboardEvent): void {
    if (this.hightlighter) {
      const lines: NodeList = this.editor.nativeElement.querySelectorAll('.view-line');
      lines.forEach(line => this.hightlighter.highlightLine(line as HTMLDivElement));
      this.neutrinoService.restoreSelection(this.editor);
    }
  }

  /**
   * Refreshes {@link NeutrinoComponent.lines} array.
   * Called whenever there's a change in the editor.
   */
  private refreshLines(event?: KeyboardEvent): void {
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
  private handleAutoComplete(event: KeyboardEvent): void {
    let opening: Text;
    let closure: Text;

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
      const emptyLine = line.textContent === '';
      const oneLine = this.editor.nativeElement.querySelectorAll('.view-line').length === 1;

      if (emptyLine && oneLine) {
        if (!line.firstChild) {
          this.renderer.appendChild(line, this.renderer.createElement('br'));
        }

        event.preventDefault();
        return;
      }
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

      for (let i = 0 ; i < this.tabSpaces; i++) {
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
  private addNewLineOnEnter(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      const sel: Selection = document.getSelection();
      const range: Range = sel.getRangeAt(0);
      const currentLine: HTMLDivElement = this.neutrinoService.getClosestViewLine(this.editor);

      range.setEndAfter(currentLine.lastChild);
      const content = range.extractContents();
      range.collapse(false);
      const textContent = content.textContent;
      const closureIndex = this.findFirstIndexOfClosureAfterOpening(currentLine.textContent, textContent);
      let newLine;

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
      this.refreshLines();
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
