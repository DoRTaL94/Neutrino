import { ElementRef, Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { Subject } from 'rxjs';
import { EditorState } from './editor-state';
import { DefaultEditorOptions, EditorOptions } from './editor.options';


/**
 * Event types controlled by {@link NeutrinoService}.
 */
export enum EventType {
  KeyUp = 'keyup',
  KeyDown = 'keydown',
  KeyPressed = 'keypressed',
  MouseDown = 'mousedown',
  MouseUp = 'mouseup',
  Click = 'click',
  Input = 'input',
  Copy = 'copy',
  Paste = 'paste',
  Cut = 'cut'
}

/**
 * Offers DOM maniplations service methods for a given editor.
 * Handles editor's events instead of the component for simplification of the component itself.
 */
@Injectable({
  providedIn: 'root'
})
export class NeutrinoService {
  /**
   * A map to store event handlers callbacks for each editor.
   * Key: ElementRef of the editor,
   * Value: A map whose key is the event type name, and value is the callback for this event.
   */
  private eventsCallbacks: Map<ElementRef, Map<string, ((event: Event) => void)[]>> = new Map<
    ElementRef,
    Map<string, ((event: Event) => void)[]>
  >();

  /**
   * A map to store event handlers callbacks, for each editor, to be executed after the events
   * specified in {@link NeutrinoService.eventsCallbacks}, and after the editor was rendered.
   * Key: ElementRef of the editor,
   * Value: A map whose key is the event type name, and value is the callback for this event.
   */
  private eventsCallbacksToExecLast: Map<ElementRef, Map<string, ((event: Event) => void)[]>> = new Map<
    ElementRef,
    Map<string, ((event: Event) => void)[]>
  >();

  private editorsState: Map<ElementRef, EditorState> = new Map<ElementRef, EditorState>();
  private valueChangedSubjects: Map<ElementRef, Subject<string>> = new Map<ElementRef, Subject<string>>();
  private editorsOptions: Map<ElementRef, EditorOptions> = new Map<ElementRef, EditorOptions>();
  private renderer: Renderer2;

  constructor(private rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  public setEditorOptions(editor: ElementRef, options: EditorOptions) {
    this.editorsOptions.set(editor, options);
  }

  public getValueChangedListener(editor: ElementRef) {
    if (!this.valueChangedSubjects.has(editor)) {
      this.valueChangedSubjects.set(editor, new Subject<string>());
    }

    return this.valueChangedSubjects.get(editor).asObservable();
  }

  /**
   * Adds a new line to a given editor.
   *
   * @param editor An editor reference to add add new line to.
   * @param setCaretInside If true the new line is focused and the caret is inside.
   * @param text A text to insert into the new line.
   * @param lineToAddAfter A line to insert the new line after.
   */
  public addNewLine(editor: ElementRef, setCaretInside?: boolean, text?: string, lineToAddAfter?: HTMLDivElement) {
    const newLine: HTMLDivElement = this.createLine();

    if (text) {
      newLine.innerHTML = '';
      this.renderer.appendChild(newLine, this.renderer.createText(text));
    }

    if (lineToAddAfter) {
      if (lineToAddAfter.nextSibling) {
        this.renderer.insertBefore(editor.nativeElement, newLine, lineToAddAfter.nextSibling);
      } else {
        this.renderer.appendChild(editor.nativeElement, newLine);
      }
    } else {
      this.renderer.appendChild(editor.nativeElement, newLine);
    }

    if (setCaretInside) {
      const sel = document.getSelection();

      if (sel && sel.anchorNode) {
        const range = sel.getRangeAt(0);
        range.setStart(newLine, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    return newLine;
  }

  /**
   * @param editor The parent editor reference of the given "lineToAline" input.
   * @param lineToAlign A line to align its content based on the amount of non-breaking spaces at the beginning of the previous line.
   */
  public keepTextAligned(editor: ElementRef, lineToAlign: HTMLDivElement): void {
    if (lineToAlign.previousSibling) {
      const prevLineContent: string = lineToAlign.previousSibling.textContent;
      let nonBreakingSpaceCounter = this.getCountOfNBSAtTheStartOfText(prevLineContent);

      if (lineToAlign.nextSibling) {
        const nextLineContent: string = lineToAlign.nextSibling.textContent;

        if (
          nextLineContent.lastIndexOf('}') !== -1 &&
          prevLineContent.lastIndexOf('{') !== -1 &&
          lineToAlign.textContent[lineToAlign.textContent.length - 1] !== '}'
        ) {
          if (nonBreakingSpaceCounter === 0) {
            nonBreakingSpaceCounter = this.editorsOptions.get(editor).tabSpaces;
          } else {
            nonBreakingSpaceCounter += this.editorsOptions.get(editor).tabSpaces;
          }
        }
      }

      this.insertNBSAtStartOfLine(lineToAlign, nonBreakingSpaceCounter);
    }
  }

  /**
   * Adds event handlers for a given editor.
   *
   * @param editor The editor reference to add an event handler to.
   * @param eventType The type of the event to be handled.
   * @param callback The calleback to be executed after an event of type "eventType" is fired.
   * @param executeAfterRender If "true" the callback will be called after render, else, before it.
   */
  public addEventHandler(
    editor: ElementRef,
    eventType: EventType,
    callback: (event: Event) => void,
    executeAfterRender?: boolean
  ): void {
    if (!this.editorsState.has(editor)) {
      this.editorsState.set(editor, new EditorState());
    }

    if (
      (executeAfterRender && this.eventsCallbacksToExecLast.get(editor)) ||
      (!executeAfterRender && this.eventsCallbacks.get(editor))
    ) {
      const eventHandlers = executeAfterRender ?
        this.eventsCallbacksToExecLast.get(editor) :
        this.eventsCallbacks.get(editor);
      const callbacks = eventHandlers.get(eventType);

      if (callbacks) {
        callbacks.push(callback);
      } else {
        eventHandlers.set(eventType, [callback]);
      }
    } else {
      const eventHandlers = new Map<string, ((event: Event) => void)[]>();
      eventHandlers.set(eventType, [callback]);

      if (executeAfterRender) {
        this.eventsCallbacksToExecLast.set(editor, eventHandlers);
      } else {
        this.eventsCallbacks.set(editor, eventHandlers);
      }
    }
  }

  /**
   * Handles a DOM fired event of a given editor.
   * Calls all of the callbacks bound to this event (with {@link addEventHandler} method).
   * Right after all of the callbacks is executed this method renders the new changes,
   * and then calls all of the callbacks in {@link eventsCallbacksToExecLast} map.
   *
   * @param editor The editor reference whose event was fired.
   * @param event The event that fired.
   */
  public handleEvent(editor: ElementRef, event: Event): void {
    let eventCallbacks = this.eventsCallbacks.get(editor);
    this.executeEvents(event, eventCallbacks);
    this.refreshEditorState(editor);

    if (
      event instanceof KeyboardEvent &&
      this.checkKeyToRender(event as KeyboardEvent)
    ) {
      this.render(editor);
      this.restoreSelection(editor);

      if (event.type === 'keyup') {
        this.valueChangedSubjects.get(editor).next(this.getEditorText(editor));
      }
    }

    eventCallbacks = this.eventsCallbacksToExecLast.get(editor);
    this.executeEvents(event, eventCallbacks);
  }

  /**
   * Restore a given editor selection.
   * Occurs after every render.
   *
   * @param editor A editor reference to restore its selection.
   */
  public restoreSelection(editor: ElementRef): void {
    const sel: Selection = window.getSelection();
    const lines: NodeList = editor.nativeElement.querySelectorAll('.view-line');
    const state: EditorState = this.editorsState.get(editor);
    const line: Node = lines[state.currentLine];
    const textSegments = this.getTextSegments(line, false);

    let anchorNode = line;
    let anchorIndex = 0;
    let focusNode = line;
    let focusIndex = 0;
    let currentIndex = 0;

    textSegments.forEach(({ text, node }) => {
      const startIndexOfNode = currentIndex;
      const endIndexOfNode = startIndexOfNode + text.length;

      if (startIndexOfNode <= state.anchorIndex && state.anchorIndex <= endIndexOfNode) {
        anchorNode = node;
        anchorIndex = state.anchorIndex - startIndexOfNode;
      }

      if (startIndexOfNode <= state.focusIndex && state.focusIndex <= endIndexOfNode) {
        focusNode = node;
        focusIndex = state.focusIndex - startIndexOfNode;
      }

      currentIndex += text.length;
    });

    if (focusNode) {
      this.focusLine(
        editor,
        this.getParentLine(editor, focusNode as HTMLElement) as HTMLDivElement
      );
    }

    sel.setBaseAndExtent(anchorNode, anchorIndex, focusNode, focusIndex);
  }

  /**
   * Loops through all the elements inside a given node
   * and creates an array of pairs of text and its containing node.
   *
   * @param element The element node to return its text segments.
   * @param downOneLevel If true this method returns the text content of the direct childs of the "element" input.
   * Else, it traverses the children node tree until it reached a node of type "TEXT_NODE".
   */
  public getTextSegments(element: Node, downOneLevel?: boolean): { text: string; node: Node }[] {
    const textSegments: { text: string; node: Node }[] = [];

    if (element) {
      Array.from(element.childNodes).forEach((node) => {
        switch (node.nodeType) {
          case Node.TEXT_NODE:
            textSegments.push({ text: node.textContent, node });
            break;

          case Node.ELEMENT_NODE:
            if (downOneLevel) {
              textSegments.push({ text: node.textContent, node });
            } else {
              textSegments.splice(textSegments.length, 0, ...this.getTextSegments(node, downOneLevel));
            }
            break;

          default:
            throw new Error(`Unexpected node type: ${node.nodeType}`);
        }
      });
    }

    return textSegments;
  }

  /**
   * @param editor A editor reference to returns its text content.
   */
  public getEditorText(editor: ElementRef): string {
    const lines: string[] = [];

    this.getTextSegments(editor.nativeElement, true)
    .forEach((line, index) => {
      lines.push(line.text);
    });

    return lines.join('\n');
  }

  /**
   * @param editor The editor reference to find its focused line.
   * @returns The focused line element.
   */
  public getClosestViewLine(editor: ElementRef): HTMLDivElement {
    const sel = document.getSelection();
    return this.getParentLine(editor, sel.focusNode as HTMLElement);
  }

  /**
   *  Returns the parent line element of a given child.
   *
   * @param editor The parent editor reference of a given "child" input.
   * @param child An element inside a line element.
   */
  public getParentLine(editor: ElementRef, child: HTMLElement): HTMLDivElement {
    let anchorLine: HTMLElement = child;

    while (
      (!anchorLine.classList || !anchorLine.classList.contains('view-line')) &&
      !anchorLine.isSameNode(editor.nativeElement)
    ) {
      anchorLine = anchorLine.parentElement;
    }

    if (child.isSameNode(editor.nativeElement)) {
      anchorLine = null;
    }

    return anchorLine as HTMLDivElement;
  }

  /**
   * Renders a given editor view.
   * Occurs after every change.
   *
   * @param editor The editor reference to be rendered.
   * @param value If given the editor will be rendered with this initial text.
   */
  public render(editor: ElementRef, value?: string): void {
    const editorNative = editor.nativeElement as HTMLSpanElement;
    let editorText;

    if (value) {
      editorText = Array.from(value);
    } else {
      const textSegments = this.getTextSegments(editorNative, true);
      editorText = Array.from(
        textSegments
        .map(segment => segment.text)
        .join('\n')
      );
    }

    editorText.push('\n');
    editorNative.innerHTML = '';

    const editorTextLength = editorText.length;
    let lineNumber = 1;
    let line = this.appendLine(editor, lineNumber);
    let currentText = '';

    editorText.forEach((char, index) => {
      if (char === '\n') {
        if (currentText !== '') {
          // line is empty so we want to remove the <br> inside.
          if (line.textContent === '') {
            line.innerHTML = '';
          }

          this.appendText(line, currentText);
          currentText = '';
        }

        if (index < editorTextLength - 1) {
          lineNumber++;
          line = this.appendLine(editor, lineNumber);
        }
      } else if (char === '\t') {
        if (currentText !== '') {
          this.appendText(line, currentText);
        }

        this.appendTab(editor, line);
        currentText = '';
      } else {
        currentText += char;
      }
    });
  }

  /**
   * @param lineNumber If given the created line will be created with an id of "line-[lineNumber]".
   */
  public createLine(lineNumber?: number): HTMLDivElement {
    const line: HTMLDivElement = this.renderer.createElement('div');
    const br: HTMLBRElement = this.renderer.createElement('br');

    if (lineNumber) {
      line.id = `line-${lineNumber}`;
    }

    this.renderer.addClass(line, 'view-line');
    this.renderer.appendChild(line, br);

    return line;
  }

  /**
   * @internal
   *
   * Counts the amount of non-breaking spaces at the start of the given text.
   */
  private getCountOfNBSAtTheStartOfText(text: string): number {
    let nonBreakingSpaceCounter = 0;

    for (const char of text) {
      if (char === '\u00a0') {
        nonBreakingSpaceCounter++;
      } else {
        break;
      }
    }

    return nonBreakingSpaceCounter;
  }

  /**
   * @internal
   *
   * @param line A Line to insert non-breaking spaces at the beginning.
   * @param nonBreakingSpaceCount The amount of non-breaking spaces to insert.
   */
  private insertNBSAtStartOfLine(line: HTMLDivElement, nonBreakingSpaceCount: number) {
    if (nonBreakingSpaceCount !== 0) {
      const sel: Selection = document.getSelection();
      const range: Range = new Range();

      range.setStart(line, 0);
      range.collapse(true);

      for (let i = 0; i < nonBreakingSpaceCount; i++) {
        const nonBreakingSpace = this.renderer.createText('\u00a0');
        range.insertNode(nonBreakingSpace);
        range.setStartAfter(nonBreakingSpace);
        range.collapse(true);
      }

      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  /**
   * @internal
   *
   * Executes all of the callbacks bound to a given event.
   */
  private executeEvents(event: Event, eventCallbacks: Map<string, ((event: Event) => void)[]>) {
    if (eventCallbacks) {
      const callBacks = eventCallbacks.get(event.type);

      if (callBacks) {
        callBacks.forEach((callback) => {
          callback(event);
        });
      }
    }
  }

  /**
   * @internal
   */
  private checkKeyToRender(event: KeyboardEvent): boolean {
    return  event                      &&
            event.ctrlKey              &&
            event.altKey               &&
            event.key !== 'ArrowUp'    &&
            event.key !== 'ArrowRight' &&
            event.key !== 'ArrowDown'  &&
            event.key !== 'ArrowLeft'  &&
            event.key !== 'Shift'      &&
            event.key !== 'Control'    &&
            event.key !== 'Alt'        &&
            event.key !== 'End'        &&
            event.key !== 'Home';
  }

  /**
   * @internal
   *
   * Creates a div element with a br element inside and sets a "view-line" class name to it,
   * then appends it to a given editor.
   *
   * @param editor The parent editor reference to append the line to.
   * @param lineNumber If given the created line will be created with an id of "line-[lineNumber]".
   */
  private appendLine(editor: ElementRef, lineNumber?: number): HTMLDivElement {
    const line = this.createLine(lineNumber);
    this.renderer.appendChild(editor.nativeElement, line);

    return line;
  }

  /**
   * @internal
   *
   * Insert a number of non-breaking spaces into a given line.
   * This number can be changed with {@link setEditorOptions} method (The default number is 2).
   *
   * @param editor The parent editor reference of the "line" input.
   * @param line A line element to append a tab to.
   */
  private appendTab(editor: ElementRef, line: HTMLDivElement) {
    let editorOptions = this.editorsOptions.get(editor);

    if (!editorOptions) {
      editorOptions = new DefaultEditorOptions();
    }

    for (let i = 0; i < editorOptions.tabSpaces; i++) {
      this.renderer.appendChild(line, this.renderer.createText('\u00a0'));
    }
  }

  /**
   * @internal
   *
   * Creates a text node for a given text and append that node as the last child of a given line.
   *
   * @param line A line to append the text to.
   * @param text The text to append.
   */
  private appendText(line: HTMLDivElement, text: string): void {
    const textNode = this.renderer.createText(text);
    this.renderer.appendChild(line, textNode);
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
  private focusLine(editor: ElementRef, line: HTMLDivElement) {
    const lines = editor.nativeElement.querySelectorAll('.view-line');
    const state: EditorState = this.editorsState.get(editor);

    if (line) {
      let currentLineSet = false;
      state.currentLine = 0;

      lines.forEach((currLine) => {
        if (currLine === line) {
          currentLineSet = true;
          this.renderer.addClass(currLine, 'focus');
        } else {
          this.renderer.removeClass(currLine, 'focus');
        }

        if (!currentLineSet) {
          state.currentLine++;
        }
      });
    }
  }

  /**
   * @internal
   *
   * Refreshes the state of a given editor.
   *
   * @param editor A editor reference to refresh its state.
   */
  private refreshEditorState(editor: ElementRef) {
    const sel: Selection = document.getSelection();
    const line: HTMLDivElement = this.getClosestViewLine(editor);
    const state: EditorState = this.editorsState.get(editor);

    if (line) {
      this.refreshCurrentLine(editor, line);
      let currentIndex = 0;
      const textSegments = this.getTextSegments(line, false);

      textSegments.forEach(({ text, node }) => {
        if (node === sel.anchorNode) {
          state.anchorIndex = currentIndex + sel.anchorOffset;
        } else if (node.parentElement === sel.anchorNode) {
          const range = new Range();
          range.selectNode(node);
          state.anchorIndex = currentIndex + sel.anchorOffset - range.startOffset;
        }

        if (node === sel.focusNode) {
          state.focusIndex = currentIndex + sel.focusOffset;
        } else if (node.parentElement === sel.focusNode) {
          const range = new Range();
          range.selectNode(node);
          state.focusIndex = currentIndex + sel.focusOffset - range.startOffset;
        }

        currentIndex += text.length;
      });
    }
  }

  /**
   * @internal
   *
   * Sets {@link currentLine} to be the line number of "lineElement" input.
   *
   * @param editor The parent editor of the "lineElement" input.
   * @param lineElement An element which represents a line.
   */
  private refreshCurrentLine(editor: ElementRef, lineElement: Node): void {
    const lines: NodeList = editor.nativeElement.querySelectorAll('.view-line');
    const linesCount = lines.length;
    const state: EditorState = this.editorsState.get(editor);

    for (let i = 0; i < linesCount; i++) {
      state.currentLine = i;

      if (lines[i] === lineElement) {
        break;
      }
    }
  }
}
